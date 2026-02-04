## 2026-02-04 14:44:46

feat: Add CSV import and improved bulk sending with progress tracking

- Add import-csv.js to parse participant data from CSV files
- Support 3 categories: running, senam, and tenant participants
- Add category tabs and search filtering in frontend
- Add random delay (5-12s) between messages to avoid spam detection
- Add real-time progress UI with numbered queue list
- Show sending status for each contact (pending/sending/sent/failed)
- Add cancel functionality with clear status visibility
- Update templates for Run Madan 2026 event
- Add placeholders: {name}, {pendaftar}, {noreg}

---

## 2026-02-04 13:27:52

feat: Add web-based bulk messaging interface

- Add Express server with API endpoints for sending messages
- Add simple HTML frontend for composing and sending bulk messages
- Add contacts.json for storing recipient phone numbers
- Add templates.json for predefined message templates
- Add test-qr.js for terminal QR code authentication
- Support {name} placeholder for personalized messages
- Show success/fail status for each message sent

---

