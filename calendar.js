require('dotenv').config();

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const { google } = require('googleapis');
const serviceAccount = require('./calendar-service.json');

const serviceAccountAuth = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: 'https://www.googleapis.com/auth/calendar',
});

const calendarId = process.env.CALENDAR_ID;
const calendar = google.calendar('v3');

const getAppointments = (startedAt, endedAt) => {
  return new Promise((resolve, reject) => {
    calendar.events.list(
      {
        auth: serviceAccountAuth,
        calendarId: calendarId,
        timeMin: startedAt.toISOString(),
        timeMax: endedAt.toISOString(),
      },
      (err, calendarResponse) => {
        if (err || calendarResponse.data.items.length == 0) {
          reject(err || new Error('No appointment'));
        }

        let dateString = '';
        if (startedAt.isSame(endedAt, 'day')) {
          dateString = startedAt.tz('Asia/Singapore').format('ddd D MMM');
        } else {
          const startedAtString = startedAt
            .tz('Asia/Singapore')
            .format('ddd D MMM');
          const endedAtString = endedAt
            .tz('Asia/Singapore')
            .format('ddd D MMM');
          dateString = `${startedAtString} - ${endedAtString}`;
        }

        const response = `*🗓 Event list on ${dateString}*\n\n`;
        const eventListStrings = calendarResponse.data.items
          .map(event => {
            const start = event.start.dateTime || event.start.date;
            const startString = dayjs(start)
              .tz('Asia/Singapore')
              .format('hh:mm a');
            return `- ${startString} - ${event.summary}`;
          })
          .join('\n');
        resolve(`${response}${eventListStrings}`);
      },
    );
  });
};

const checkOverlapAppointments = (startedAt, endedAt) => {
  const targetStart = startedAt.subtract(30, 'minute');
  const targetEnd = endedAt.add(30, 'minute');
  return new Promise((resolve, reject) => {
    calendar.events.list(
      {
        auth: serviceAccountAuth,
        calendarId: calendarId,
        timeMin: targetStart.toISOString(),
        timeMax: targetEnd.toISOString(),
      },
      (err, calendarResponse) => {
        if (err) {
          reject(err);
        }

        if (calendarResponse.data.items.length == 0) {
          resolve(null);
        } else {
          const eventListStrings = calendarResponse.data.items
            .map(event => {
              const start = event.start.dateTime || event.start.date;
              const end = event.end.dateTime || event.end.date;
              const startString = dayjs(start)
                .tz('Asia/Singapore')
                .format('hh:mm a');

              const endString = dayjs(end)
                .tz('Asia/Singapore')
                .format('hh:mm a');
              return `- *${event.summary}*: ${startString} to ${endString}`;
            })
            .join('\n');
          resolve(eventListStrings);
        }
      },
    );
  });
};

const createAppointment = (title, startedAt, endedAt) => {
  return new Promise((resolve, reject) => {
    const options = {
      auth: serviceAccountAuth, // List events for time period
      calendarId: calendarId,
      timeMin: startedAt.toISOString(),
      timeMax: endedAt.toISOString(),
    };
    calendar.events.list(options, (err, calendarResponse) => {
      if (err || calendarResponse.data.items.length > 0) {
        reject(
          err ||
            new Error('⛔️ Requested time conflicts with another appointment'),
        );
      } else {
        calendar.events.insert(
          {
            auth: serviceAccountAuth,
            calendarId: calendarId,
            resource: {
              summary: title,
              description: title,
              start: { dateTime: startedAt },
              end: { dateTime: endedAt },
            },
          },
          (err, event) => {
            if (err !== null) {
              reject(err);
            } else {
              resolve(event);
            }
          },
        );
      }
    });
  });
};

module.exports = {
  getAppointments,
  createAppointment,
  checkOverlapAppointments,
};
