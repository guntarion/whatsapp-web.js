const fs = require('fs');
const path = require('path');

// Helper: Convert phone number to 62 format
function formatPhone(phone) {
    if (!phone) return null;

    // Remove all non-digit characters
    let cleaned = phone.toString().replace(/\D/g, '');

    // Handle various formats
    if (cleaned.startsWith('62')) {
        return cleaned;
    } else if (cleaned.startsWith('0')) {
        return '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8')) {
        return '62' + cleaned;
    }

    return cleaned;
}

// Helper: Parse CSV line (handles quoted fields with commas)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

// Helper: Parse CSV file
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Remove BOM if present
    const cleanContent = content.replace(/^\uFEFF/, '');
    const lines = cleanContent.split('\n').filter(line => line.trim());

    const headers = parseCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        data.push(row);
    }

    return data;
}

// Process Running participants
function processRunning(data) {
    const contacts = [];
    let currentRegistrant = null;

    data.forEach((row, index) => {
        // If has No Registrasi, this is a new registrant
        if (row['No Registrasi']) {
            currentRegistrant = {
                noRegistrasi: row['No Registrasi'],
                namaPendaftar: row['Nama Pendaftar'],
                phone: formatPhone(row['No HP']),
            };
        }

        // Add participant (either main registrant or additional)
        if (row['Nama Peserta'] && currentRegistrant) {
            contacts.push({
                id: contacts.length + 1,
                category: 'running',
                noRegistrasi: currentRegistrant.noRegistrasi,
                namaPendaftar: currentRegistrant.namaPendaftar,
                phone: currentRegistrant.phone,
                noPeserta: row['No Peserta'] || '0',
                namaPeserta: row['Nama Peserta'],
                jenisKelamin: row['Jenis Kelamin'],
                noBib: row['No Bib'] || '',
                statusPembayaran: row['Status Pembayaran'] || ''
            });
        }
    });

    return contacts;
}

// Process Senam participants
function processSenam(data) {
    const contacts = [];
    let currentRegistrant = null;

    data.forEach((row, index) => {
        // If has No Registrasi, this is a new registrant
        if (row['No Registrasi']) {
            currentRegistrant = {
                noRegistrasi: row['No Registrasi'],
                namaPendaftar: row['Nama Pendaftar'],
                phone: formatPhone(row['No HP']),
            };
        }

        // Add participant
        if (row['Nama Peserta'] && currentRegistrant) {
            contacts.push({
                id: contacts.length + 1,
                category: 'senam',
                noRegistrasi: currentRegistrant.noRegistrasi,
                namaPendaftar: currentRegistrant.namaPendaftar,
                phone: currentRegistrant.phone,
                noKupon: row['No Kupon'] || '',
                namaPeserta: row['Nama Peserta'],
                jenisKelamin: row['Jenis Kelamin'],
                usia: row['Usia'] || '',
                statusKonfirmasi: row['Status Konfirmasi'] || ''
            });
        }
    });

    return contacts;
}

// Process Tenant participants
function processTenant(data) {
    const contacts = [];

    data.forEach((row, index) => {
        if (row['No Registrasi'] && row['Nama Tenant']) {
            contacts.push({
                id: contacts.length + 1,
                category: 'tenant',
                noRegistrasi: row['No Registrasi'],
                namaTenant: row['Nama Tenant'],
                namaPenanggungJawab: row['Nama Penanggung Jawab'],
                phone: formatPhone(row['No Telepon']),
                email: row['Email'] || '',
                jenisProduk: row['Jenis Produk'] || '',
                namaProdukUtama: row['Nama Produk Utama'] || '',
                statusPembayaran: row['Status Pembayaran'] || ''
            });
        }
    });

    return contacts;
}

// Main
function main() {
    const dataDir = path.join(__dirname, 'data');

    console.log('Importing CSV files...\n');

    // Process each file
    const runningFile = path.join(dataDir, 'run-madan-2026-2026-02-04.csv');
    const senamFile = path.join(dataDir, 'senam-sehat-run-madan-2026-2026-02-04.csv');
    const tenantFile = path.join(dataDir, 'tenant-run-madan-2026-2026-02-04.csv');

    let allContacts = [];

    // Running
    if (fs.existsSync(runningFile)) {
        const runningData = parseCSV(runningFile);
        const runningContacts = processRunning(runningData);
        console.log(`Running participants: ${runningContacts.length}`);
        allContacts = allContacts.concat(runningContacts);
    }

    // Senam
    if (fs.existsSync(senamFile)) {
        const senamData = parseCSV(senamFile);
        const senamContacts = processSenam(senamData);
        console.log(`Senam participants: ${senamContacts.length}`);
        allContacts = allContacts.concat(senamContacts);
    }

    // Tenant
    if (fs.existsSync(tenantFile)) {
        const tenantData = parseCSV(tenantFile);
        const tenantContacts = processTenant(tenantData);
        console.log(`Tenant participants: ${tenantContacts.length}`);
        allContacts = allContacts.concat(tenantContacts);
    }

    // Re-assign IDs
    allContacts.forEach((contact, index) => {
        contact.id = index + 1;
    });

    console.log(`\nTotal contacts: ${allContacts.length}`);

    // Filter contacts with valid phone numbers
    const validContacts = allContacts.filter(c => c.phone && c.phone.length >= 10);
    console.log(`Contacts with valid phone: ${validContacts.length}`);

    // Save to contacts.json
    fs.writeFileSync(
        path.join(__dirname, 'contacts.json'),
        JSON.stringify(validContacts, null, 2),
        'utf-8'
    );

    console.log('\nSaved to contacts.json');

    // Print summary by category
    const byCategory = {};
    validContacts.forEach(c => {
        byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    });
    console.log('\nBy category:');
    Object.entries(byCategory).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
    });
}

main();
