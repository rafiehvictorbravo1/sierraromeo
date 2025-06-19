let topics = JSON.parse(localStorage.getItem('topics') || '[]');
let filter = 'all';
let subjectFilter = 'all';
let undoStack = [];
let redoStack = [];

// --- History tracking functions ---
function recordAction(action) {
  undoStack.push(action);
  redoStack = []; // clear redo stack
}

function undo() {
  if (undoStack.length === 0) return;
  const action = undoStack.pop();
  const { topicIndex, reviewIndex, oldDate, newDate } = action;

  topics[topicIndex].reviews[reviewIndex] = oldDate;
  redoStack.push(action);
  saveTopics();
  renderTopics();
  refreshCalendar();
}

function redo() {
  if (redoStack.length === 0) return;
  const action = redoStack.pop();
  const { topicIndex, reviewIndex, newDate } = action;

  topics[topicIndex].reviews[reviewIndex] = newDate;
  undoStack.push(action);
  saveTopics();
  renderTopics();
  refreshCalendar();
}

function refreshCalendar() {
  const calendar = FullCalendar.getCalendar(document.getElementById('calendar'));
  calendar.removeAllEvents();
  calendar.addEventSource(generateCalendarEvents());
}

function generateReviewDates() {
  const now = new Date();
  return [
    now,
    new Date(now.getTime() + 1 * 86400000),
    new Date(now.getTime() + 7 * 86400000),
    new Date(now.getTime() + 16 * 86400000),
    new Date(now.getTime() + 35 * 86400000),
    new Date(now.getFullYear(), now.getMonth() + 2, now.getDate()),
    new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()),
    new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
    new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()),
  ];
}

function addTopic(name, subject) {
  topics.push({
    name,
    subject,
    reviews: generateReviewDates(),
    completed: []
  });
  saveTopics();
  renderTopics();
  populateSubjectFilter();
}

function markDone(topic, dateIndex) {
  if (!topic.completed.includes(dateIndex)) {
    topic.completed.push(dateIndex);
  }
  saveTopics();
  renderTopics();
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function getTopicsForDate(date) {
  const result = [];
  topics.forEach((topic, topicIndex) => {
    topic.reviews.forEach((revDate, i) => {
      if (isSameDate(new Date(revDate), date)) {
        result.push({ topic, index: topicIndex, reviewIndex: i });
      }
    });
  });
  return result;
}

function getStatus(topic) {
  const today = new Date();
  for (let i = 0; i < topic.reviews.length; i++) {
    const due = new Date(topic.reviews[i]);
    if (isSameDate(due, today) && !topic.completed.includes(i)) return 'pending';
    if (due < today && !topic.completed.includes(i)) return 'still';
  }
  return 'done';
}

function renderTopics() {
  const list = document.getElementById('topic-list');
  list.innerHTML = '';

  topics.forEach((topic, idx) => {
    const status = getStatus(topic);
    const query = document.getElementById('search-input').value.trim().toLowerCase();
     if (
     (filter !== 'all' && filter !== status) ||
     (subjectFilter !== 'all' && subjectFilter !== topic.subject) ||
     (query && !topic.name.toLowerCase().includes(query) && !topic.subject.toLowerCase().includes(query))
    ) return;


    const li = document.createElement('li');
    li.innerHTML = `
     <strong>${topic.name}</strong> <em>(${topic.subject})</em> - ${status.toUpperCase()}
     ${status === 'pending' ? `<button class="btn-done" onclick="markDone(topics[${idx}], ${getTodayReviewIndex(topic)})">✔ Done</button>` : ''}
     <button class="btn-edit" onclick="editTopic(${idx})">✏️ Edit</button>
     <button class="btn-delete" onclick="deleteTopic(${idx})">🗑 Delete</button>
    `;
    list.appendChild(li);
  });

  updateStats();
}

function populateSubjectFilter() {
  const subjectSet = new Set(topics.map(t => t.subject));
  const filter = document.getElementById('subject-filter');
  filter.innerHTML = `<option value="all">All Subjects</option>`;
  subjectSet.forEach(subject => {
    const option = document.createElement('option');
    option.value = subject;
    option.textContent = subject;
    filter.appendChild(option);
  });
}

function editTopic(index) {
  const topic = topics[index];
  const newName = prompt("Edit topic name:", topic.name);
  if (newName === null || newName.trim() === "") return;

  const newSubject = prompt("Edit subject tag:", topic.subject);
  if (newSubject === null || newSubject.trim() === "") return;

  const newNotes = prompt("Edit notes (optional):", topic.notes || "");
  if (newNotes === null) return;  // allow empty notes, so no trim check here

  topic.name = newName.trim();
  topic.subject = newSubject.trim();
  topic.notes = newNotes;

  saveTopics();
  renderTopics();
  populateSubjectFilter();
}

function deleteTopic(index) {
  const confirmed = confirm(`Are you sure you want to delete "${topics[index].name}"?`);
  if (confirmed) {
    topics.splice(index, 1);
    saveTopics();
    renderTopics();
    populateSubjectFilter();
  }
}

function getTodayReviewIndex(topic) {
  const today = new Date();
  for (let i = 0; i < topic.reviews.length; i++) {
    const d = new Date(topic.reviews[i]);
    if (isSameDate(today, d)) return i;
  }
  return -1;
}

function saveTopics() {
  localStorage.setItem('topics', JSON.stringify(topics));
}

function setFilter(newFilter) {
  filter = newFilter;
  renderTopics();
}

document.getElementById('topic-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('topic-name').value.trim();
  const subject = document.getElementById('topic-subject').value.trim();
  if (name && subject) {
    addTopic(name, subject);
    document.getElementById('topic-form').reset();
  }
});

document.getElementById('subject-filter').addEventListener('change', e => {
  subjectFilter = e.target.value;
  renderTopics();
});

document.getElementById('import-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const importedTopics = JSON.parse(event.target.result);

      if (!Array.isArray(importedTopics)) {
        alert('Invalid data format.');
        return;
      }

      if (confirm('Replace existing topics with imported data? Click Cancel to merge.')) {
        topics = importedTopics;
      } else {
        importedTopics.forEach(newTopic => {
          if (!topics.some(t => t.name === newTopic.name && t.subject === newTopic.subject)) {
            topics.push(newTopic);
          }
        });
      }

      saveTopics();
      populateSubjectFilter();
      renderTopics();
      alert('Data imported successfully.');
    } catch (err) {
      alert('Error reading file: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});


document.getElementById('export-btn').addEventListener('click', () => {
  const dataStr = JSON.stringify(topics, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'topics_backup.json';
  a.click();

  URL.revokeObjectURL(url);
});


function updateStats() {
  let dueToday = 0;
  let stillPending = 0;
  let completed = 0;
  const today = new Date();

  topics.forEach(topic => {
    topic.reviews.forEach((reviewDate, i) => {
      const review = new Date(reviewDate);
      const isDone = topic.completed.includes(i);

      if (isSameDate(today, review) && !isDone) dueToday++;
      else if (review < today && !isDone) stillPending++;
      else if (isDone) completed++;
    });
  });

  document.getElementById('due-today').textContent = dueToday;
  document.getElementById('still-pending').textContent = stillPending;
  document.getElementById('completed-total').textContent = completed;
}

function generateCalendarEvents() {
  const events = [];
  topics.forEach((topic, topicIndex) => {
    topic.reviews.forEach((date, reviewIndex) => {
      const completed = topic.completed.includes(reviewIndex);
      events.push({
        title: `${topic.name} (${topic.subject}) ${completed ? '✔' : ''}`,
        date: new Date(date).toISOString().split('T')[0],
        color: completed ? 'green' : 'red',
        extendedProps: {
          topicIndex,
          reviewIndex
        }
      });
    });
  });
  return events;
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('search-input').addEventListener('input', renderTopics);
  const calendarEl = document.getElementById('calendar');

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    editable: true,
    events: generateCalendarEvents(),

    eventDrop: function(info) {
      const { topicIndex, reviewIndex } = info.event.extendedProps;
      const newDate = info.event.start;

      if (typeof topicIndex !== 'number' || typeof reviewIndex !== 'number') {
        alert('Event metadata missing.');
        info.revert();
        return;
      }

      const oldDate = new Date(topics[topicIndex].reviews[reviewIndex]);
      topics[topicIndex].reviews[reviewIndex] = newDate;

      recordAction({ topicIndex, reviewIndex, oldDate, newDate });
      saveTopics();
      renderTopics();
      refreshCalendar();
    },

    dayCellDidMount: function(info) {
      const popup = document.getElementById('hover-popup');

      info.el.addEventListener('mouseenter', () => {
        const dayDate = info.date;
        const dueTopics = getTopicsForDate(dayDate);

        if (dueTopics.length > 0) {
          popup.innerHTML = dueTopics.map(t => `<div><strong>${t.topic.name}</strong> (${t.topic.subject})</div>`).join('');
          popup.style.display = 'block';

          const rect = info.el.getBoundingClientRect();
          popup.style.top = rect.bottom + window.scrollY + 4 + 'px';
          popup.style.left = rect.left + window.scrollX + 'px';
        }
      });

      info.el.addEventListener('mouseleave', () => {
        popup.style.display = 'none';
      });
    },

    dateClick: function(info) {
      const dayDate = info.date;
      const dueTopics = getTopicsForDate(dayDate);

      if (dueTopics.length === 0) {
        alert("No topics due on this date.");
        return;
      }

      const modalContent = dueTopics.map(t => {
        const idx = t.index;
        const rIndex = t.reviewIndex;
        const isChecked = t.topic.completed.includes(rIndex);

        return `<div><label><input type="checkbox" data-topic-index="${idx}" data-review-index="${rIndex}" ${isChecked ? 'checked' : ''}> ${t.topic.name} (${t.topic.subject})</label></div>`;
      }).join('');

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `<div class="modal-box"><h3>Topics on ${dayDate.toDateString()}</h3>${modalContent}<button onclick="this.closest('.modal').remove()">Close</button></div>`;
      document.body.appendChild(modal);

      modal.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const topicIdx = parseInt(cb.dataset.topicIndex);
          const reviewIdx = parseInt(cb.dataset.reviewIndex);
          const topic = topics[topicIdx];
          const done = topic.completed.includes(reviewIdx);

          if (cb.checked && !done) topic.completed.push(reviewIdx);
          else if (!cb.checked && done) topic.completed = topic.completed.filter(i => i !== reviewIdx);

          saveTopics();
          renderTopics();
        });
      });
    }
  });

  calendar.render();
});

populateSubjectFilter();
subjectFilter = document.getElementById('subject-filter').value || 'all';
renderTopics();

document.addEventListener('keydown', function(e) {
  const ctrlOrCmd = e.ctrlKey || e.metaKey;
  if (ctrlOrCmd && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
  } else if (ctrlOrCmd && e.key === 'y') {
    e.preventDefault();
    redo();
  }
});
