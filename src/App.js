import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';

import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

import './App.css';

function App() {
  const [events, setEvents] = useState([]);
  const [selectedOffsets, setSelectedOffsets] = useState([]); // minutes
  const [onlineOnly, setOnlineOnly] = useState(false); // NEW toggle

  // --- Offset parsing helpers ---
  function parseOffsetStringToMinutes(s) {
    if (!s) return null;
    const str = String(s).trim();

    let m = str.match(/(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i);
    if (m) {
      const sign = m[1] === '+' ? 1 : -1;
      const hours = parseInt(m[2], 10);
      const minutes = m[3] ? parseInt(m[3], 10) : 0;
      return sign * (hours * 60 + minutes);
    }

    m = str.match(/(?:UTC|GMT)([+-]\d{1,2}(?::\d{2})?)/i);
    if (m) {
      const mm = m[1];
      const sign = mm[0];
      const rest = mm.slice(1).split(':');
      const hours = parseInt(rest[0], 10);
      const minutes = rest[1] ? parseInt(rest[1], 10) : 0;
      return (sign === '+' ? 1 : -1) * (hours * 60 + minutes);
    }

    m = str.match(/^([+-])\s*(\d{1,2})(?::?(\d{2}))?$/);
    if (m) {
      const sign = m[1] === '+' ? 1 : -1;
      const hours = parseInt(m[2], 10);
      const minutes = m[3] ? parseInt(m[3], 10) : 0;
      return sign * (hours * 60 + minutes);
    }

    m = str.match(/([+-]\d{1,2}(?::\d{2})?)/);
    if (m) {
      const mm = m[1];
      const sign = mm[0];
      const rest = mm.slice(1).split(':');
      const hours = parseInt(rest[0], 10);
      const minutes = rest[1] ? parseInt(rest[1], 10) : 0;
      return (sign === '+' ? 1 : -1) * (hours * 60 + minutes);
    }

    return null;
  }

  function getUTCOffsetMinutes(timezoneString) {
    if (!timezoneString) return null;
    const parsed = parseOffsetStringToMinutes(timezoneString);
    if (parsed !== null) return parsed;

    try {
      const now = new Date();
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezoneString }));
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
    } catch {
      return null;
    }
  }

  function formatOffsetLabel(minutes) {
    if (minutes === 0) return 'UTC';
    const sign = minutes > 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    return mins === 0
      ? `UTC${sign}${hours}`
      : `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`;
  }

  // --- Load events ---
  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/data.json`)
      .then(res => res.json())
      .then(data => {
        const mapped = data.map((e) => {
          const tzString = e.Timezone ?? '';
          const offsetMinutes = getUTCOffsetMinutes(tzString);
          return {
            title: e['Competition Name'] ?? 'Event',
            start: e.start,
            end: e.end,
            extendedProps: {
              description: e,
              timezone: tzString,
              offsetMinutes,
              online: (e['Online/In Person'] || '').toLowerCase() === 'online'
            },
            offsetMinutes
          };
        });
        setEvents(mapped);
      })
      .catch(err => {
        console.error('Failed to load /data.json', err);
        setEvents([]);
      });
  }, []);

  // --- Build list of UTC offsets present in events ---
  const offsetsFromEvents = Array.from(
    new Set(events.map(ev => ev.offsetMinutes).filter(m => m !== null))
  )
    .filter(mins => mins >= -720 && mins <= 720)
    .sort((a, b) => a - b);

  // --- Toggle logic ---
  const handleOffsetToggle = (mins) => {
    setSelectedOffsets(prev =>
      prev.includes(mins) ? prev.filter(x => x !== mins) : [...prev, mins]
    );
  };

  const handleOnlineToggle = () => {
    setOnlineOnly(prev => !prev);
  };

  // --- Filter events ---
  const filteredEvents = events.filter(ev => {
    const matchOffset =
      selectedOffsets.length === 0 || (ev.offsetMinutes !== null && selectedOffsets.includes(ev.offsetMinutes));
    const matchOnline = !onlineOnly || ev.extendedProps.online;
    return matchOffset && matchOnline;
  });

  // --- Render ---
  return (
    <div style={{ maxWidth: 900, margin: '40px auto' }}>
      {/* Online toggle */}
      <div style={{ marginBottom: 10 }}>
        <button
          onClick={handleOnlineToggle}
          style={{
            margin: '4px',
            background: onlineOnly ? '#28a745' : '#eee',
            color: onlineOnly ? '#fff' : '#333',
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: '6px 12px',
            cursor: 'pointer'
          }}
        >
          Online Only
        </button>
      </div>

      {/* UTC offset toggles */}
      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap' }}>
        {offsetsFromEvents.map(mins => (
          <button
            key={mins}
            onClick={() => handleOffsetToggle(mins)}
            style={{
              margin: '4px',
              background: selectedOffsets.includes(mins) ? '#007bff' : '#eee',
              color: selectedOffsets.includes(mins) ? '#fff' : '#333',
              border: '1px solid #ccc',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: 'pointer'
            }}
          >
            {formatOffsetLabel(mins)}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={filteredEvents}
        timeZone="local"
        eventMouseEnter={(info) => {
          const descriptionObj = info.event.extendedProps.description || {};
          const htmlDescription = Object.entries(descriptionObj).map(
            ([key, value]) =>
              `<div><strong>${key}:</strong> ${value}</div>`
          ).join('');
          tippy(info.el, {
            content: `<div class="tippy-description">${htmlDescription || 'No description available'}</div>`,
            allowHTML: true,
            placement: 'left',
            arrow: true,
            theme: 'light',
          });
        }}
      />
    </div>
  );
}

export default App;
