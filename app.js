const STORAGE_KEY = "KurtKoolRandomizerLists";
const PREV_STORAGE_KEY = "KurtRandomizerLists";

// Fallback for older Safari versions that don't support crypto.randomUUID()
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

let state = {
    lists: [], selectedListIndex: 0, repeatAllowed: false, selectedItem: "",
    newItem: "", pastedItems: "", newListName: "", groupingMode: "size",
    groupValue: 3, groups: [], currentGroup: 0,
    pendingListDeletion: null, pendingItemDeletion: null
};

function loadLists() {
    const currentData = localStorage.getItem(STORAGE_KEY);
    if (currentData) { try { const parsed = JSON.parse(currentData); if (parsed && parsed.length > 0) return parsed; } catch (e) {} }
    const prevData = localStorage.getItem(PREV_STORAGE_KEY);
    if (prevData) { try { const parsed = JSON.parse(prevData); if (parsed && parsed.length > 0) return parsed; } catch (e) {} }
    return [{ id: generateUUID(), name: "List", items: [], calledIDs: [], history: [] }];
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lists)); }
function getActiveList() { return state.lists[state.selectedListIndex]; }
function getEligibleItems() { return getActiveList().items.filter(i => !i.excluded); }
function getAvailableItems() {
    const active = getActiveList();
    return getEligibleItems().filter(i => state.repeatAllowed || !active.calledIDs.includes(i.id));
}

function render() {
    const active = getActiveList();
    const available = getAvailableItems();
    document.getElementById('activeListName').textContent = active.name;
    document.getElementById('selectedItem').textContent = state.selectedItem || "WHO'S NEXT?";
    document.getElementById('drawBtn').disabled = available.length === 0;
    document.getElementById('repeatAllowed').checked = state.repeatAllowed;
    document.getElementById('remainingCount').textContent = available.length;
    document.getElementById('repeatModeLabel').textContent = state.repeatAllowed ? "REPEAT MODE: ON" : "NO-REPEAT MODE";
    document.getElementById('historyCount').textContent = `${active.history.length} SELECTED`;
    const historyGrid = document.getElementById('historyGrid');
    if (active.history.length === 0) {
        historyGrid.innerHTML = '<div class="empty-state">No selections recorded.</div>';
    } else {
        historyGrid.innerHTML = active.history.map((name, idx) => `<div class="history-item"><span class="num">${String(idx + 1).padStart(2, '0')}</span><span>${name}</span></div>`).join('');
    }
    document.querySelectorAll('.seg-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === state.groupingMode));
    const modeText = state.groupingMode === 'size' ? 'ITEMS PER GROUP' : 'NUMBER OF GROUPS';
    document.getElementById('groupValueDisplay').textContent = `${modeText}: ${state.groupValue}`;
    document.getElementById('generateGroupsBtn').disabled = getEligibleItems().length === 0;
    const groupsContainer = document.getElementById('groupsContainer');
    if (state.groups.length > 0) {
        groupsContainer.classList.remove('hidden');
        const accents = ['var(--cyan)', 'var(--violet)', 'var(--lime)', '#ff8c40'];
        const visibleGroups = state.groups.slice(0, state.currentGroup + 1);
        document.getElementById('groupsGrid').innerHTML = visibleGroups.map((group, idx) => {
            const accent = accents[idx % accents.length];
            return `<div class="group-card" style="border-color: ${accent}"><div class="g-title" style="color: ${accent}">GROUP ${String(idx + 1).padStart(2, '0')}</div><div class="g-divider" style="background: ${accent}"></div>${group.map(name => `<div class="g-name">${name}</div>`).join('')}</div>`;
        }).join('');
        document.getElementById('groupsProgress').textContent = `${Math.min(state.currentGroup + 1, state.groups.length)} / ${state.groups.length} GROUPS`;
        document.getElementById('nextGroupBtn').disabled = state.currentGroup >= state.groups.length - 1;
        document.getElementById('nextGroupBtn').style.opacity = state.currentGroup >= state.groups.length - 1 ? '0.35' : '1';
    } else { groupsContainer.classList.add('hidden'); }
}

function renderListMenu() {
    const container = document.getElementById('listMenuItems');
    container.innerHTML = state.lists.map((list, idx) => `<div class="list-menu-item ${idx === state.selectedListIndex ? 'active' : ''}"><span>${idx === state.selectedListIndex ? '✓ ' : ''}${list.name}</span><div class="list-menu-actions"><button onclick="openEditList(${idx})" title="Edit">✎</button><button class="delete" onclick="confirmDeleteList(${idx})" title="Delete">🗑</button></div></div>`).join('');
}

function renderEditList() {
    const active = getActiveList();
    document.getElementById('editListNameInput').value = active.name;
    const itemsContainer = document.getElementById('editListItems');
    if (active.items.length === 0) {
        itemsContainer.innerHTML = '<div class="empty-state">No names added yet.</div>';
    } else {
        itemsContainer.innerHTML = active.items.map(item => `<div class="edit-list-item"><input type="text" class="cyber-input" value="${item.name}" onchange="updateItemName('${item.id}', this.value)"><button class="delete-btn" onclick="confirmDeleteItem('${item.id}')">🗑</button></div>`).join('');
    }
}

function drawItem() {
    const available = getAvailableItems();
    if (available.length === 0) return;
    const item = available[Math.floor(Math.random() * available.length)];
    state.selectedItem = item.name;
    const active = getActiveList();
    if (!state.repeatAllowed) active.calledIDs.push(item.id);
    active.history.push(item.name);
    save(); render();
    if (!state.repeatAllowed && getAvailableItems().length === 0) showAlert("List Completed", "Reset the selection round to start again.");
}
function resetRound() {
    const active = getActiveList();
    active.calledIDs = []; active.history = [];
    state.selectedItem = ""; state.groups = []; state.currentGroup = 0;
    save(); render();
}
function generateGroups() {
    let names = getEligibleItems().map(i => i.name);
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    if (names.length === 0) return;
    let result = [];
    if (state.groupingMode === 'size') {
        const size = Math.max(1, state.groupValue);
        while (names.length > 0) {
            let group = names.splice(0, size);
            if (size === 2 && group.length === 1) group.push("Kurt");
            result.push(group);
        }
    } else {
        const numGroups = Math.min(Math.max(1, state.groupValue), names.length);
        const baseSize = Math.floor(names.length / numGroups);
        const remainder = names.length % numGroups;
        for (let i = 0; i < numGroups; i++) { const size = baseSize + (i < remainder ? 1 : 0); result.push(names.splice(0, size)); }
    }
    state.groups = result; state.currentGroup = 0; render();
}
function createList() {
    const name = state.newListName.trim();
    if (!name) return;
    state.lists.push({ id: generateUUID(), name, items: [], calledIDs: [], history: [] });
    state.selectedListIndex = state.lists.length - 1;
    state.newListName = ""; state.selectedItem = ""; state.groups = []; state.currentGroup = 0;
    save(); render(); closeModal('listMenuModal');
}
function deletePendingList() {
    if (state.lists.length <= 1) { showAlert("Cannot Delete", "You must have at least one list."); return; }
    const idx = state.lists.findIndex(l => l.id === state.pendingListDeletion);
    if (idx === -1) return;
    state.lists.splice(idx, 1);
    if (idx < state.selectedListIndex) state.selectedListIndex--;
    else if (idx === state.selectedListIndex) state.selectedListIndex = Math.min(idx, state.lists.length - 1);
    state.pendingListDeletion = null; state.selectedItem = ""; state.groups = []; state.currentGroup = 0;
    save(); render(); closeModal('listMenuModal');
}
function addItem() {
    const name = state.newItem.trim();
    if (!name) return;
    getActiveList().items.push({ id: generateUUID(), name, excluded: false });
    state.newItem = ""; document.getElementById('newItemInput').value = "";
    save(); renderEditList(); render();
}
function importItems() {
    const names = state.pastedItems.split('\n').map(n => n.trim()).filter(n => n);
    names.forEach(name => getActiveList().items.push({ id: generateUUID(), name, excluded: false }));
    state.pastedItems = ""; document.getElementById('pastedItemsInput').value = "";
    save(); renderEditList(); render();
}
function updateItemName(id, newName) {
    const item = getActiveList().items.find(i => i.id === id);
    if (item) { item.name = newName; save(); render(); }
}
function confirmDeleteItem(id) {
    if (confirm("Delete this name?")) {
        getActiveList().items = getActiveList().items.filter(i => i.id !== id);
        getActiveList().calledIDs = getActiveList().calledIDs.filter(cid => cid !== id);
        save(); renderEditList(); render();
    }
}
function confirmDeleteList(idx) {
    state.pendingListDeletion = state.lists[idx].id;
    if (confirm(`Delete the entire list "${state.lists[idx].name}" and its history?`)) deletePendingList();
}
function openEditList(idx) {
    state.selectedListIndex = idx; closeModal('listMenuModal'); renderEditList(); openModal('editListModal');
}
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    openModal('alertModal');
}

document.addEventListener('DOMContentLoaded', () => {
    state.lists = loadLists(); render();
    document.getElementById('drawBtn').addEventListener('click', drawItem);
    document.getElementById('resetBtn').addEventListener('click', resetRound);
    document.getElementById('repeatAllowed').addEventListener('change', (e) => { state.repeatAllowed = e.target.checked; render(); });
    document.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => { state.groupingMode = btn.dataset.mode; state.groupValue = 3; render(); });
    });
    document.getElementById('decrementGroup').addEventListener('click', () => { if (state.groupValue > 1) { state.groupValue--; render(); } });
    document.getElementById('incrementGroup').addEventListener('click', () => {
        const max = Math.max(1, getEligibleItems().length);
        if (state.groupValue < max) { state.groupValue++; render(); }
    });
    document.getElementById('generateGroupsBtn').addEventListener('click', generateGroups);
    document.getElementById('startOverGroupsBtn').addEventListener('click', () => { state.groups = []; state.currentGroup = 0; render(); });
    document.getElementById('nextGroupBtn').addEventListener('click', () => { if (state.currentGroup < state.groups.length - 1) { state.currentGroup++; render(); } });
    document.getElementById('listMenuBtn').addEventListener('click', () => { renderListMenu(); openModal('listMenuModal'); });
    document.getElementById('closeListMenuBtn').addEventListener('click', () => closeModal('listMenuModal'));
    document.getElementById('createListBtn').addEventListener('click', () => {
        const name = prompt("Enter new list name:");
        if (name && name.trim()) { state.newListName = name.trim(); createList(); }
    });
    document.getElementById('closeEditListBtn').addEventListener('click', () => {
        const newName = document.getElementById('editListNameInput').value.trim();
        if (newName) { getActiveList().name = newName; save(); render(); }
        closeModal('editListModal');
    });
    document.getElementById('addItemBtn').addEventListener('click', addItem);
    document.getElementById('newItemInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') addItem(); });
    document.getElementById('importItemsBtn').addEventListener('click', importItems);
    document.getElementById('closeAlertBtn').addEventListener('click', () => closeModal('alertModal'));
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed', err));
    });
}
