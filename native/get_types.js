const fs = require('fs');
const content = fs.readFileSync('node_modules/expo-notifications/build/Notifications.types.d.ts', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('export interface NotificationContentInput'));
const end = lines.findIndex((l, i) => i > start && l.includes('}'));
console.log(lines.slice(start, end + 1).join('\n'));
