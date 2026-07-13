/**
 * ======================================================================
 * SISTEM KONTROL TIMESHEET FREELANCE ONSITE (TKF) - PT JAPA INDOTAMA
 * FASE 1-4 LENGKAP
 * TKF-01 s/d TKF-11 + Mesin Upah sesuai "Standart Upah Tenaga Kerja
 * Harian Lepas (Freelance)" PT Japa Indotama, berlaku 01 Jan 2026 - 31 Des 2027.
 * ======================================================================
 * Semua data disimpan di Google Sheet yang sama dengan tempat script ini
 * ditempel (container-bound script).
 * ======================================================================
 */

// ============================================================
// BAGIAN 1: KONFIGURASI GLOBAL
// Nilai di bawah ini adalah DEFAULT/CADANGAN. Untuk mengubahnya
// sehari-hari, gunakan menu "🛠️ Pengaturan Sistem" (tersimpan di
// Script Properties) -- TIDAK perlu edit kode ini.
// ============================================================
const CONFIG = {
  JAM_KERJA_STANDAR: 8,          // Jam kerja normal/hari sebelum dihitung lembur
  FAKTOR_HARI_LIBUR: 2,          // Pengganda upah jika kerja di hari Minggu / hari libur nasional
  UANG_SARAPAN_DEFAULT: 20000,   // Uang pengganti sarapan/hari jika lokasi tidak menyediakan sarapan
  RADIUS_DEFAULT_METER: 100,     // Radius toleransi default (meter) jika lokasi belum diatur
  ZONA_WAKTU: 'GMT+7',           // Zona waktu pencatatan (WIB)
  PANJANG_PIN: 6,                // Jumlah digit PIN login pekerja
  EMAIL_HRD: '',                 // Default kosong, isi lewat menu Pengaturan Sistem
  JAM_REMINDER: 9,               // Jam reminder check-in otomatis (format 24 jam)
  PASSWORD_AKSES: ''             // Default kosong = Dashboard & Approval TIDAK diproteksi password
};

const SHEETS = {
  PEKERJA: 'db_pekerja_freelance',
  LOKASI: 'db_lokasi_proyek',
  PRESENSI: 'db_presensi',
  REKAP: 'db_rekap',
  IZIN_LEMBUR: 'db_izin_lembur',
  STANDAR_UPAH: 'db_standar_upah',
  HARI_LIBUR: 'db_hari_libur',
  AKUN_INTERNAL: 'db_akun_internal'
};

// Urutan kolom tiap sheet. PENTING: kolom BARU selalu ditambahkan di UJUNG
// (bukan disisipkan di tengah) supaya migrasi otomatis pada sheet yang sudah
// ada tetap sinkron posisinya dengan array ini.
const HEADERS = {
  PEKERJA: ['ID_Pekerja','Nama','NIK','No_HP','PIN','Jenis_Pekerjaan','Tarif_Harian','Tarif_Per_Jam','ID_Lokasi','Status','Tanggal_Daftar','Posisi_Standar','Uang_Makan_Harian','Uang_Transport_Harian'],
  LOKASI: ['ID_Lokasi','Nama_Proyek','Alamat','Latitude','Longitude','Radius_Meter','PIC_Nama','PIC_HP','Status','Tanggal_Mulai','PIC_Email','Tipe_Lokasi','Sarapan_Disediakan'],
  PRESENSI: ['ID_Presensi','ID_Pekerja','Nama_Pekerja','ID_Lokasi','Nama_Lokasi','Tanggal','Jam_CheckIn','Lat_CheckIn','Lng_CheckIn','Jarak_CheckIn_M','Status_CheckIn','Jam_CheckOut','Lat_CheckOut','Lng_CheckOut','Jarak_CheckOut_M','Status_CheckOut','Total_Jam_Kerja','Jam_Lembur','Upah_Harian','Upah_Lembur','Total_Upah','Status_Anomali','Status_Approval','Catatan_Approval','Approved_By','Approved_At','Tipe_Hari','Uang_Makan','Uang_Transport','Uang_Sarapan'],
  REKAP: ['ID_Rekap','Periode','ID_Pekerja','Nama_Pekerja','ID_Lokasi','Nama_Lokasi','Total_Hari_Kerja','Total_Jam_Kerja','Total_Jam_Lembur','Total_Upah_Harian','Total_Upah_Lembur','Total_Upah','Tanggal_Generate','Total_Uang_Makan','Total_Uang_Transport','Total_Uang_Sarapan','Grand_Total','Kasbon','Sisa_Upah'],
  IZIN_LEMBUR: ['ID_Pengajuan','ID_Pekerja','Nama_Pekerja','ID_Lokasi','Nama_Lokasi','Jenis_Pengajuan','Kategori_Izin','Tanggal_Berlaku','Estimasi_Jam_Lembur','Keterangan','Lampiran_URL','Diinput_Oleh','Status_Approval','Catatan_Approval','Approved_By','Approved_At','Tanggal_Pengajuan'],
  STANDAR_UPAH: ['ID_Posisi','Nama_Posisi','Rate_8Jam_Min','Rate_8Jam_Maks','Rate_1Jam_Min','Rate_1Jam_Maks','Rate_10Jam_Min','Rate_10Jam_Maks','Uang_Makan_Standar','Uang_Transport_Standar'],
  HARI_LIBUR: ['Tanggal', 'Keterangan'],
  AKUN_INTERNAL: ['ID_Akun', 'Nama', 'No_HP', 'PIN', 'Role', 'Lokasi_Ditangani', 'Email', 'Status', 'Tanggal_Daftar']
};

/**
 * Data acuan "Standart Upah Tenaga Kerja Harian Lepas (Freelance)" PT Japa
 * Indotama, masa berlaku 01 Jan 2026 - 31 Des 2027. Dipakai untuk mengisi
 * sheet db_standar_upah otomatis saat pertama kali setup (HANYA jika sheet
 * masih kosong -- jika HR sudah pernah mengedit datanya, TIDAK akan ditimpa).
 * Urutan angka: [Nama, Rate8Min, Rate8Maks, Rate1Min, Rate1Maks, Rate10Min, Rate10Maks, UangMakan, UangTransport]
 */
const DATA_STANDAR_UPAH_DEFAULT = [
  ['Project Manager',            560000, 800000,  70000, 100000,  700000, 1000000, 65000, 25000],
  ['Project Engineer',           320000, 480000,  40000,  60000,  400000,  600000, 65000, 15000],
  ['Safety Officer',             200000, 320000,  25000,  40000,  250000,  400000, 65000, 15000],
  ['Supervisor',                 440000, 560000,  55000,  70000,  550000,  700000, 65000, 15000],
  ['Foreman',                    280000, 360000,  35000,  45000,  350000,  450000, 65000, 15000],
  ['Electrical Technician',      200000, 240000,  25000,  30000,  250000,  300000, 65000, 15000],
  ['Electrical Engineer',        280000, 360000,  35000,  45000,  350000,  450000, 65000, 15000],
  ['Instrument Technician',      200000, 240000,  25000,  30000,  250000,  300000, 65000, 15000],
  ['Instrument Engineer',        280000, 360000,  35000,  45000,  350000,  450000, 65000, 15000],
  ['Senior Mechanic',            180000, 240000,  22500,  30000,  225000,  300000, 65000, 15000],
  ['Junior Mechanic',            148000, 160000,  18500,  20000,  185000,  200000, 65000, 15000],
  ['Inspector & Engineer',       280000, 360000,  35000,  45000,  350000,  450000, 65000, 15000],
  ['Comissioning Engineer',      280000, 360000,  35000,  45000,  350000,  450000, 65000, 15000],
  ['Operator Crane',             240000, 280000,  30000,  35000,  300000,  350000, 65000, 15000],
  ['Rigger',                     200000, 240000,  20000,  30000,  200000,  300000, 65000, 15000],
  ['Blaster',                    160000, 240000,  20000,  30000,  200000,  300000, 65000, 15000],
  ['Fitter Konstruksi / Pipe',   160000, 240000,  20000,  30000,  200000,  300000, 65000, 15000],
  ['Welder Konstruksi / Pipe',   200000, 240000,  25000,  30000,  250000,  300000, 65000, 15000],
  ['Operator Bubut / Milling',   200000, 240000,  25000,  30000,  250000,  300000, 65000, 15000],
  ['Helper Lokal',               250000, 300000,  31250,  37500,  312500,  375000,     0, 15000],
  ['General Umum',               135000, 150000,  16875,  18750,  168750,  187500, 65000, 15000]
];


// ============================================================
// BAGIAN 2: SETUP AWAL & MENU
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🗂️ Sistem TKF')
    .addItem('⚙️ 1. Setup / Migrasi Database (Aman Dijalankan Berkali-kali)', 'setupDatabase')
    .addItem('🛠️ 2. Pengaturan Sistem (Jam Kerja, Email HRD, dll)', 'showFormSettings')
    .addSeparator()
    .addItem('➕ Tambah Pekerja Freelance', 'showFormPekerja')
    .addItem('➕ Tambah Lokasi Proyek', 'showFormLokasi')
    .addItem('👤 Tambah Akun Internal (PIC/HRD/Admin)', 'showFormAkunInternal')
    .addItem('📅 Kelola Hari Libur (utk Upah 2x Lipat)', 'showFormHariLibur')
    .addSeparator()
    .addItem('📋 Buat Rekap Timesheet (Periode)', 'showFormRekap')
    .addItem('📄 Export Timesheet PDF (Per Pekerja)', 'showFormExportTimesheet')
    .addItem('💰 Isi Kasbon', 'showFormKasbon')
    .addSeparator()
    .addItem('🛡️ Pasang Pengaman Input Rupiah (Format, Validasi, Peringatan)', 'terapkanPengamanRupiah')
    .addSeparator()
    .addItem('🔔 Aktifkan Reminder Check-in Otomatis', 'pasangTriggerReminder')
    .addItem('🔕 Matikan Reminder Check-in Otomatis', 'hapusTriggerReminder')
    .addSeparator()
    .addItem('🌐 Lihat Link Web App', 'showWebAppUrl')
    .addToUi();
}

/**
 * JALANKAN SEKALI DI AWAL, dan aman dijalankan ULANG kapan saja (misal
 * setelah update kode ini) -- akan otomatis menambahkan sheet/kolom baru
 * TANPA menghapus atau menimpa data yang sudah ada.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dibuat = [];
  let dimigrasi = [];

  Object.keys(SHEETS).forEach(function(key) {
    const namaSheet = SHEETS[key];
    let sheet = ss.getSheetByName(namaSheet);
    const headerSeharusnya = HEADERS[key];

    if (!sheet) {
      sheet = ss.insertSheet(namaSheet);
      sheet.getRange(1, 1, 1, headerSeharusnya.length).setValues([headerSeharusnya]);
      sheet.getRange(1, 1, 1, headerSeharusnya.length)
        .setFontWeight('bold').setBackground('#0B2545').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headerSeharusnya.length);
      dibuat.push(namaSheet);

      if (key === 'STANDAR_UPAH') {
        seedStandarUpah_(sheet);
      }
    } else {
      const jumlahKolomSaatIni = sheet.getLastColumn();
      const headerSaatIni = jumlahKolomSaatIni > 0
        ? sheet.getRange(1, 1, 1, jumlahKolomSaatIni).getValues()[0]
        : [];
      const kolomBaru = headerSeharusnya.filter(function(h) { return headerSaatIni.indexOf(h) === -1; });
      if (kolomBaru.length > 0) {
        sheet.getRange(1, jumlahKolomSaatIni + 1, 1, kolomBaru.length).setValues([kolomBaru]);
        sheet.getRange(1, jumlahKolomSaatIni + 1, 1, kolomBaru.length)
          .setFontWeight('bold').setBackground('#0B2545').setFontColor('#ffffff');
        dimigrasi.push(namaSheet + ' (+' + kolomBaru.join(', ') + ')');
      }
      if (key === 'STANDAR_UPAH' && sheet.getLastRow() < 2) {
        seedStandarUpah_(sheet);
      }
    }
  });

  const sheetDefault = ss.getSheetByName('Sheet1');
  if (sheetDefault && sheetDefault.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheetDefault);
  }

  let pesan = '';
  if (dibuat.length > 0) pesan += 'Sheet baru dibuat:\n' + dibuat.join('\n') + '\n\n';
  if (dimigrasi.length > 0) pesan += 'Sheet dimigrasi (kolom baru ditambahkan):\n' + dimigrasi.join('\n') + '\n\n';
  if (!pesan) pesan = 'Semua sheet sudah lengkap & up to date. Tidak ada perubahan.';
  SpreadsheetApp.getUi().alert('Setup / Migrasi Selesai', pesan, SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Mengisi sheet db_standar_upah dengan data resmi dari dokumen Standart Upah PT Japa. */
function seedStandarUpah_(sheet) {
  const rows = DATA_STANDAR_UPAH_DEFAULT.map(function(p, i) {
    const id = 'POS-' + Utilities.formatString('%02d', i + 1);
    return [id, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]];
  });
  sheet.getRange(2, 1, rows.length, HEADERS.STANDAR_UPAH.length).setValues(rows);
  sheet.autoResizeColumns(1, HEADERS.STANDAR_UPAH.length);
}

function showWebAppUrl() {
  const url = ScriptApp.getService().getUrl();
  const ui = SpreadsheetApp.getUi();
  if (!url) {
    ui.alert('Web App belum di-deploy.\n\nSilakan klik Deploy > New deployment terlebih dahulu (lihat panduan).');
  } else {
    ui.alert('Link Web App Sistem TKF',
      'Halaman Check-in & Riwayat Absensi Pekerja:\n' + url + '\n\n' +
      'Halaman Approval PIC/Mandor:\n' + url + '?page=approval\n\n' +
      'Halaman Pengajuan Izin/Lembur:\n' + url + '?page=pengajuan\n\n' +
      'Halaman Dashboard Monitoring:\n' + url + '?page=dashboard',
      ui.ButtonSet.OK);
  }
}


// ============================================================
// BAGIAN 3: HELPER UMUM
// ============================================================

function getSheet_(namaSheetKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS[namaSheetKey]);
  if (!sheet) {
    throw new Error('Sheet "' + SHEETS[namaSheetKey] + '" belum ada. Jalankan menu Setup Database dahulu.');
  }
  return sheet;
}

function sheetToObjects_(namaSheetKey) {
  const sheet = getSheet_(namaSheetKey);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const header = HEADERS[namaSheetKey];
  const data = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();
  return data.map(function(row, idx) {
    const obj = {};
    header.forEach(function(h, i) { obj[h] = row[i]; });
    obj._rowNumber = idx + 2;
    return obj;
  });
}

function generateId_(prefix, namaSheetKey) {
  const sheet = getSheet_(namaSheetKey);
  const lastRow = sheet.getLastRow();
  const nomor = Utilities.formatString('%06d', lastRow);
  return prefix + '-' + nomor + '-' + new Date().getTime().toString().slice(-4);
}

function formatTanggal_(date) {
  return Utilities.formatDate(date, CONFIG.ZONA_WAKTU, 'yyyy-MM-dd');
}

function formatJam_(date) {
  return Utilities.formatDate(date, CONFIG.ZONA_WAKTU, 'HH:mm:ss');
}

function hitungJarakMeter_(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = function(deg) { return deg * Math.PI / 180; };
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Menyertakan file HTML lain (dipakai untuk menyisipkan Styles.html bersama). */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Mengubah nomor kolom (1,2,3...) jadi huruf kolom Spreadsheet (A,B,C...). Dipakai untuk menulis formula. */
function columnToLetter_(kolom) {
  let temp, huruf = '';
  while (kolom > 0) {
    temp = (kolom - 1) % 26;
    huruf = String.fromCharCode(temp + 65) + huruf;
    kolom = (kolom - temp - 1) / 26;
  }
  return huruf;
}

// ============================================================
// PENGAMAN INPUT RUPIAH
// Kumpulan fungsi untuk mengurangi risiko salah ketik angka Rupiah:
// format mata uang, validasi angka, conditional formatting untuk
// tarif di luar standar, dan peringatan saat mengedit kolom sensitif.
// Aman dijalankan berkali-kali (idempotent) -- jalankan ulang kapan saja
// setelah menambah kolom baru di masa depan.
// ============================================================

const BANYAK_BARIS_PROTEKSI_ = 1000; // cakupan baris ke depan untuk format/validasi

/** Menerapkan format mata uang "Rp #.##0" pada kolom-kolom tertentu di suatu sheet. */
function formatKolomRupiah_(sheet, sheetKey, namaKolomList) {
  if (!sheet) return;
  const header = HEADERS[sheetKey];
  namaKolomList.forEach(function(nama) {
    const idx = header.indexOf(nama);
    if (idx === -1) return;
    sheet.getRange(2, idx + 1, BANYAK_BARIS_PROTEKSI_, 1).setNumberFormat('Rp #,##0;-Rp #,##0');
  });
}

/** Memasang validasi "harus angka >= 0" pada satu kolom, menolak input yang tidak valid. */
function pasangValidasiMinimalNol_(sheet, sheetKey, namaKolom, pesan) {
  if (!sheet) return;
  const header = HEADERS[sheetKey];
  const idx = header.indexOf(namaKolom);
  if (idx === -1) return;
  const range = sheet.getRange(2, idx + 1, BANYAK_BARIS_PROTEKSI_, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(false)
    .setHelpText(pesan)
    .build();
  range.setDataValidation(rule);
}

/**
 * Memasang "protect range dengan mode peringatan" (bukan mengunci total) pada
 * satu kolom. Siapa pun yang mengedit akan melihat pop-up peringatan dulu,
 * tapi tetap BISA lanjut mengedit jika memang perlu.
 */
function pasangPeringatanEdit_(sheet, sheetKey, namaKolom, pesan) {
  if (!sheet) return;
  const header = HEADERS[sheetKey];
  const idx = header.indexOf(namaKolom);
  if (idx === -1) return;
  const range = sheet.getRange(2, idx + 1, BANYAK_BARIS_PROTEKSI_, 1);

  // Hapus proteksi lama di kolom ini dulu (supaya tidak dobel kalau dijalankan berkali-kali)
  const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  existing.forEach(function(p) {
    if (p.getDescription() === 'Peringatan: ' + namaKolom) p.remove();
  });

  const protection = range.protect().setDescription('Peringatan: ' + namaKolom);
  protection.setWarningOnly(true);
}

/** Validasi khusus kolom Kasbon: harus 0 atau lebih, DAN tidak boleh melebihi Grand_Total di baris yang sama. */
function pasangValidasiKasbon_(sheet) {
  if (!sheet) return;
  const header = HEADERS.REKAP;
  const idxKasbon = header.indexOf('Kasbon');
  const idxGrandTotal = header.indexOf('Grand_Total');
  if (idxKasbon === -1 || idxGrandTotal === -1) return;

  const kolomKasbonHuruf = columnToLetter_(idxKasbon + 1);
  const kolomGrandTotalHuruf = columnToLetter_(idxGrandTotal + 1);
  const range = sheet.getRange(2, idxKasbon + 1, BANYAK_BARIS_PROTEKSI_, 1);

  const rule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied(
      '=AND(' + kolomKasbonHuruf + '2>=0,' + kolomKasbonHuruf + '2<=' + kolomGrandTotalHuruf + '2)'
    )
    .setAllowInvalid(false)
    .setHelpText('Kasbon harus 0 atau lebih, dan tidak boleh melebihi Grand Total pekerja ini pada baris yang sama.')
    .build();
  range.setDataValidation(rule);
}

/**
 * Conditional formatting: sel Tarif_Harian otomatis berwarna MERAH kalau
 * angkanya di luar rentang standar (Rate_8Jam_Min - Rate_8Jam_Maks) untuk
 * posisi pekerja tersebut, dicocokkan dari sheet db_standar_upah.
 */
function pasangConditionalTarifDiLuarStandar_(ss) {
  const sheet = ss.getSheetByName(SHEETS.PEKERJA);
  if (!sheet) return;
  const header = HEADERS.PEKERJA;
  const idxTarif = header.indexOf('Tarif_Harian');
  const idxPosisi = header.indexOf('Posisi_Standar');
  if (idxTarif === -1 || idxPosisi === -1) return;

  const kolomTarifHuruf = columnToLetter_(idxTarif + 1);
  const kolomPosisiHuruf = columnToLetter_(idxPosisi + 1);
  const range = sheet.getRange(2, idxTarif + 1, BANYAK_BARIS_PROTEKSI_, 1);

  const headerStandar = HEADERS.STANDAR_UPAH;
  const idxNamaPosisiStd = headerStandar.indexOf('Nama_Posisi') + 1;
  const idxMinStd = headerStandar.indexOf('Rate_8Jam_Min') + 1;
  const idxMaksStd = headerStandar.indexOf('Rate_8Jam_Maks') + 1;
  const rangeVlookup = "'" + SHEETS.STANDAR_UPAH + "'!" + columnToLetter_(idxNamaPosisiStd) + ':' + columnToLetter_(idxMaksStd);
  const kolomKeMin = idxMinStd - idxNamaPosisiStd + 1;
  const kolomKeMaks = idxMaksStd - idxNamaPosisiStd + 1;

  const formula =
    '=IFERROR(AND(' + kolomTarifHuruf + '2<>"",OR(' +
    kolomTarifHuruf + '2<VLOOKUP(' + kolomPosisiHuruf + '2,' + rangeVlookup + ',' + kolomKeMin + ',FALSE),' +
    kolomTarifHuruf + '2>VLOOKUP(' + kolomPosisiHuruf + '2,' + rangeVlookup + ',' + kolomKeMaks + ',FALSE)' +
    ')),FALSE)';

  // Buang rule lama di kolom Tarif_Harian dulu, sisakan rule kolom lain apa adanya
  const existingRules = sheet.getConditionalFormatRules().filter(function(rule) {
    return !rule.getRanges().some(function(r) { return r.getColumn() === idxTarif + 1; });
  });

  const newRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formula)
    .setBackground('#FDECEA')
    .setFontColor('#C0392B')
    .setRanges([range])
    .build();

  existingRules.push(newRule);
  sheet.setConditionalFormatRules(existingRules);
}

/**
 * JALANKAN LEWAT MENU: memasang semua pengaman input Rupiah sekaligus
 * (format mata uang + validasi angka + conditional formatting + peringatan edit)
 * di sheet db_pekerja_freelance, db_presensi, db_standar_upah, dan db_rekap.
 * Aman dijalankan berkali-kali kapan saja.
 */
function terapkanPengamanRupiah() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) db_pekerja_freelance
  const sheetPekerja = ss.getSheetByName(SHEETS.PEKERJA);
  formatKolomRupiah_(sheetPekerja, 'PEKERJA', ['Tarif_Harian', 'Tarif_Per_Jam', 'Uang_Makan_Harian', 'Uang_Transport_Harian']);
  pasangValidasiMinimalNol_(sheetPekerja, 'PEKERJA', 'Tarif_Harian', 'Tarif Harian harus berupa angka 0 atau lebih.');
  pasangPeringatanEdit_(sheetPekerja, 'PEKERJA', 'Tarif_Harian', 'Kolom ini memengaruhi perhitungan upah pekerja. Pastikan angkanya benar sebelum menyimpan.');
  pasangConditionalTarifDiLuarStandar_(ss);

  // 2) db_presensi (kolom hasil hitung otomatis skrip -- hanya format + peringatan, tanpa validasi input)
  const sheetPresensi = ss.getSheetByName(SHEETS.PRESENSI);
  formatKolomRupiah_(sheetPresensi, 'PRESENSI', ['Upah_Harian', 'Upah_Lembur', 'Total_Upah', 'Uang_Makan', 'Uang_Transport', 'Uang_Sarapan']);
  pasangPeringatanEdit_(sheetPresensi, 'PRESENSI', 'Total_Upah', 'Kolom ini dihitung OTOMATIS oleh sistem saat check-out. Mengedit manual bisa membuat data tidak akurat.');

  // 3) db_standar_upah (data referensi, jarang diedit -- cukup format saja)
  formatKolomRupiah_(ss.getSheetByName(SHEETS.STANDAR_UPAH), 'STANDAR_UPAH',
    ['Rate_8Jam_Min', 'Rate_8Jam_Maks', 'Rate_1Jam_Min', 'Rate_1Jam_Maks', 'Rate_10Jam_Min', 'Rate_10Jam_Maks', 'Uang_Makan_Standar', 'Uang_Transport_Standar']);

  // 4) db_rekap
  const sheetRekap = ss.getSheetByName(SHEETS.REKAP);
  formatKolomRupiah_(sheetRekap, 'REKAP',
    ['Total_Upah_Harian', 'Total_Upah_Lembur', 'Total_Upah', 'Total_Uang_Makan', 'Total_Uang_Transport', 'Total_Uang_Sarapan', 'Grand_Total', 'Kasbon', 'Sisa_Upah']);
  pasangValidasiKasbon_(sheetRekap);
  pasangPeringatanEdit_(sheetRekap, 'REKAP', 'Kasbon', 'Sebaiknya isi Kasbon lewat menu "💰 Isi Kasbon", supaya otomatis tervalidasi. Kalau edit manual di sini, pastikan tidak melebihi Grand Total.');
  pasangPeringatanEdit_(sheetRekap, 'REKAP', 'Sisa_Upah', 'Kolom ini berisi RUMUS OTOMATIS (Grand Total dikurangi Kasbon). Jangan diedit manual, nanti rumusnya hilang.');

  SpreadsheetApp.getUi().alert(
    'Pengaman Rupiah Diterapkan ✅',
    'Sudah dipasang di semua sheet terkait:\n' +
    '• Format mata uang (Rp #.##0)\n' +
    '• Validasi angka (tidak boleh negatif / tidak boleh melebihi batas)\n' +
    '• Kolom Tarif Harian otomatis merah kalau di luar rentang standar posisi\n' +
    '• Peringatan pop-up saat mengedit kolom sensitif\n\n' +
    'Aman dijalankan ulang kapan saja, termasuk setelah menambah kolom baru.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Menentukan apakah suatu tanggal adalah "hari libur" (Minggu ATAU terdaftar
 * di sheet db_hari_libur). Kerja di hari libur -> upah dikali FAKTOR_HARI_LIBUR.
 */
function isHariLibur_(tanggalDate) {
  if (tanggalDate.getDay() === 0) return true; // Minggu
  const tglStr = formatTanggal_(tanggalDate);
  const daftarLibur = sheetToObjects_('HARI_LIBUR');
  return daftarLibur.some(function(h) { return formatTanggal_(new Date(h.Tanggal)) === tglStr; });
}

/** Membuka dialog HTML modal dengan gaya seragam (menyertakan Styles.html lewat template). */
function bukaDialog_(namaFile, judul, lebar, tinggi) {
  const template = HtmlService.createTemplateFromFile(namaFile);
  const html = template.evaluate().setWidth(lebar).setHeight(tinggi);
  SpreadsheetApp.getUi().showModalDialog(html, judul);
}


// ============================================================
// BAGIAN 4: PENGATURAN SISTEM (TKF-11)
// ============================================================

function getConfigValue_(key, defaultValue) {
  const props = PropertiesService.getScriptProperties();
  const val = props.getProperty(key);
  return (val === null || val === undefined || val === '') ? defaultValue : val;
}

function getConfig_() {
  return {
    JAM_KERJA_STANDAR: Number(getConfigValue_('JAM_KERJA_STANDAR', CONFIG.JAM_KERJA_STANDAR)),
    FAKTOR_HARI_LIBUR: Number(getConfigValue_('FAKTOR_HARI_LIBUR', CONFIG.FAKTOR_HARI_LIBUR)),
    UANG_SARAPAN_DEFAULT: Number(getConfigValue_('UANG_SARAPAN_DEFAULT', CONFIG.UANG_SARAPAN_DEFAULT)),
    RADIUS_DEFAULT_METER: Number(getConfigValue_('RADIUS_DEFAULT_METER', CONFIG.RADIUS_DEFAULT_METER)),
    EMAIL_HRD: getConfigValue_('EMAIL_HRD', CONFIG.EMAIL_HRD),
    JAM_REMINDER: Number(getConfigValue_('JAM_REMINDER', CONFIG.JAM_REMINDER)),
    PASSWORD_AKSES: getConfigValue_('PASSWORD_AKSES', CONFIG.PASSWORD_AKSES)
  };
}

function getPengaturanSaatIni() {
  return getConfig_();
}

function simpanPengaturan(data) {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'JAM_KERJA_STANDAR': String(data.jamKerjaStandar || CONFIG.JAM_KERJA_STANDAR),
    'FAKTOR_HARI_LIBUR': String(data.faktorHariLibur || CONFIG.FAKTOR_HARI_LIBUR),
    'UANG_SARAPAN_DEFAULT': String(data.uangSarapanDefault || CONFIG.UANG_SARAPAN_DEFAULT),
    'RADIUS_DEFAULT_METER': String(data.radiusDefault || CONFIG.RADIUS_DEFAULT_METER),
    'EMAIL_HRD': data.emailHrd || '',
    'JAM_REMINDER': String(data.jamReminder || CONFIG.JAM_REMINDER),
    'PASSWORD_AKSES': data.passwordAkses || ''
  });
  return { sukses: true };
}

function showFormSettings() {
  bukaDialog_('FormSettings', 'Pengaturan Sistem TKF', 440, 680);
}

function cekPasswordAkses(passwordInput) {
  const config = getConfig_();
  if (!config.PASSWORD_AKSES) return true;
  return String(passwordInput) === String(config.PASSWORD_AKSES);
}


// ============================================================
// BAGIAN 5: doGet - ROUTING WEB APP
// ============================================================

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'checkin';
  const token = (e && e.parameter && e.parameter.token) || '';
  let namaFile = 'Checkin';
  if (page === 'approval') namaFile = 'Approval';
  else if (page === 'pengajuan') namaFile = 'Pengajuan';
  else if (page === 'dashboard') namaFile = 'Dashboard';

  const template = HtmlService.createTemplateFromFile(namaFile);
  template.webAppUrl = ScriptApp.getService().getUrl() || '';

  // Sisipkan data sesi (jika token di URL valid) supaya Checkin/Approval/Dashboard
  // bisa langsung tampil tanpa minta login ulang saat pindah halaman (Opsi 2: sesi bertoken).
  const sesi = ambilSesiToken_(token);
  template.sesiAwalJson = sesi ? JSON.stringify(sesi) : 'null';
  template.tokenAwal = token || '';

  return template.evaluate()
    .setTitle('Sistem TKF - PT Japa Indotama')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// ============================================================
// BAGIAN 6 (TKF-01): CRUD DATA PEKERJA FREELANCE
// ============================================================

function showFormPekerja() {
  bukaDialog_('FormPekerja', 'Tambah Pekerja Freelance', 480, 680);
}

function getDaftarLokasiAktif() {
  const lokasi = sheetToObjects_('LOKASI');
  return lokasi
    .filter(function(l) { return String(l.Status).toLowerCase() === 'aktif'; })
    .map(function(l) {
      return { id: l.ID_Lokasi, nama: l.Nama_Proyek, tipe: l.Tipe_Lokasi || 'Onsite' };
    });
}

/** Mengambil daftar SEMUA pekerja aktif (dipakai dropdown Export Timesheet PDF). */
function getDaftarSemuaPekerja() {
  return sheetToObjects_('PEKERJA').filter(function(p) {
    return String(p.Status).toLowerCase() === 'aktif';
  });
}

function getDaftarStandarUpah() {
  const daftar = sheetToObjects_('STANDAR_UPAH');
  return daftar.map(function(p) {
    return {
      id: p.ID_Posisi,
      nama: p.Nama_Posisi,
      rate8Min: Number(p.Rate_8Jam_Min) || 0,
      rate8Maks: Number(p.Rate_8Jam_Maks) || 0,
      uangMakan: Number(p.Uang_Makan_Standar) || 0,
      uangTransport: Number(p.Uang_Transport_Standar) || 0
    };
  });
}

function addPekerjaFromForm(data) {
  if (!data.nama || !data.noHp) {
    throw new Error('Nama dan No. HP wajib diisi.');
  }

  const semuaPekerja = sheetToObjects_('PEKERJA');
  const duplikat = semuaPekerja.some(function(p) { return String(p.No_HP) === String(data.noHp); });
  if (duplikat) {
    throw new Error('No. HP ini sudah terdaftar untuk pekerja lain.');
  }

  let pin = '';
  for (let i = 0; i < CONFIG.PANJANG_PIN; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }

  const tarifHarian = Number(data.tarifHarian) || 0;
  const tarifPerJam = Math.round(tarifHarian / getConfig_().JAM_KERJA_STANDAR);

  const id = generateId_('PKJ', 'PEKERJA');
  const sheet = getSheet_('PEKERJA');
  sheet.appendRow([
    id, data.nama, data.nik || '', data.noHp, pin,
    data.posisiNama || '',
    tarifHarian, tarifPerJam,
    data.idLokasi || '', 'Aktif', formatTanggal_(new Date()),
    data.posisiNama || '',
    Number(data.uangMakanHarian) || 0,
    Number(data.uangTransportHarian) || 0
  ]);

  return { id: id, pin: pin };
}


// ============================================================
// BAGIAN 7 (TKF-02): CRUD LOKASI & PROYEK (GEOFENCING)
// ============================================================

function showFormLokasi() {
  bukaDialog_('FormLokasi', 'Tambah Lokasi Proyek', 480, 720);
}

function addLokasiFromForm(data) {
  if (!data.namaProyek || !data.latitude || !data.longitude) {
    throw new Error('Nama proyek, latitude, dan longitude wajib diisi.');
  }
  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Format latitude/longitude tidak valid.');
  }

  const id = generateId_('LOK', 'LOKASI');
  const sheet = getSheet_('LOKASI');
  sheet.appendRow([
    id, data.namaProyek, data.alamat || '', lat, lng,
    Number(data.radius) || getConfig_().RADIUS_DEFAULT_METER,
    data.picNama || '', data.picHp || '', 'Aktif', formatTanggal_(new Date()),
    data.picEmail || '',
    data.tipeLokasi || 'Onsite',
    data.sarapanDisediakan || 'Ya'
  ]);

  return { id: id };
}


// ============================================================
// BAGIAN 8 (TKF-03): LOGIN & CHECK-IN / CHECK-OUT VIA GPS
// ============================================================

function loginPekerja(noHp, pin) {
  const semuaPekerja = sheetToObjects_('PEKERJA');
  const pekerja = semuaPekerja.find(function(p) {
    return String(p.No_HP) === String(noHp) && String(p.PIN) === String(pin);
  });

  if (!pekerja) {
    throw new Error('No. HP atau PIN salah. Silakan hubungi HRD jika lupa PIN.');
  }
  if (String(pekerja.Status).toLowerCase() !== 'aktif') {
    throw new Error('Akun Anda berstatus non-aktif. Silakan hubungi HRD.');
  }

  const semuaLokasi = sheetToObjects_('LOKASI');
  const lokasi = semuaLokasi.find(function(l) { return l.ID_Lokasi === pekerja.ID_Lokasi; });
  const statusHariIni = getStatusPresensiHariIni_(pekerja.ID_Pekerja);

  return {
    idPekerja: pekerja.ID_Pekerja,
    nama: pekerja.Nama,
    posisi: pekerja.Posisi_Standar || pekerja.Jenis_Pekerjaan || '-',
    lokasi: lokasi ? { id: lokasi.ID_Lokasi, nama: lokasi.Nama_Proyek, radius: lokasi.Radius_Meter } : null,
    statusHariIni: statusHariIni
  };
}


// ============================================================
// AKUN INTERNAL (PIC / HRD / Admin) & SISTEM SESI LOGIN TERPADU
// ============================================================
// Satu mekanisme login (No. HP + PIN) dipakai bersama oleh Pekerja DAN
// staf internal (PIC/Mandor, HRD, Admin), dibedakan lewat sheet terpisah.
// Setelah login berhasil, sistem menerbitkan "tiket sesi" (token) yang
// disimpan sementara di CacheService (maks 6 jam), supaya pekerja/PIC/HRD
// tidak perlu mengetik ulang PIN setiap kali pindah halaman (Check-in <->
// Approval <-> Dashboard).

const DURASI_SESI_DETIK_ = 21600; // 6 jam -- batas maksimum CacheService Apps Script

/** Membuka dialog form untuk menambah akun internal (PIC/HRD/Admin) baru. */
function showFormAkunInternal() {
  bukaDialog_('FormAkunInternal', 'Tambah Akun Internal', 460, 620);
}

/**
 * Menyimpan akun internal baru. Dipanggil dari FormAkunInternal.html.
 * data = { nama, noHp, role ('PIC'|'HRD'|'Admin'), daftarIdLokasi (array, khusus role PIC), email }
 * No. HP divalidasi harus unik LINTAS db_pekerja_freelance DAN db_akun_internal,
 * supaya sistem login universal tidak pernah bingung menentukan identitas seseorang.
 */
function addAkunInternalFromForm(data) {
  if (!data.nama || !data.noHp || !data.role) {
    throw new Error('Nama, No. HP, dan Role wajib diisi.');
  }

  const dipakaiPekerja = sheetToObjects_('PEKERJA').some(function(p) { return String(p.No_HP) === String(data.noHp); });
  const dipakaiAkun = sheetToObjects_('AKUN_INTERNAL').some(function(a) { return String(a.No_HP) === String(data.noHp); });
  if (dipakaiPekerja || dipakaiAkun) {
    throw new Error('No. HP ini sudah terdaftar (baik sebagai pekerja maupun akun internal lain).');
  }

  let pin = '';
  for (let i = 0; i < CONFIG.PANJANG_PIN; i++) pin += Math.floor(Math.random() * 10).toString();

  // HRD/Admin otomatis menangani SEMUA lokasi; PIC hanya lokasi yang dicentang di form
  const lokasiDitangani = (data.role === 'HRD' || data.role === 'Admin')
    ? 'SEMUA'
    : (Array.isArray(data.daftarIdLokasi) ? data.daftarIdLokasi.join(',') : '');

  const id = generateId_('AKN', 'AKUN_INTERNAL');
  const sheet = getSheet_('AKUN_INTERNAL');
  sheet.appendRow([
    id, data.nama, data.noHp, pin, data.role, lokasiDitangani,
    data.email || '', 'Aktif', formatTanggal_(new Date())
  ]);

  return { id: id, pin: pin };
}

/** Mengubah teks Lokasi_Ditangani ('SEMUA' atau daftar ID dipisah koma) jadi array ID_Lokasi, atau null jika 'SEMUA'. */
function parseLokasiDitangani_(teks) {
  if (!teks || String(teks).toUpperCase() === 'SEMUA') return null; // null = akses semua lokasi
  return String(teks).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
}

/** Mencari akun internal berdasarkan No. HP + PIN. Mengembalikan null (TIDAK throw) jika tidak cocok, supaya bisa dipakai sebagai langkah pertama sebelum fallback ke login pekerja. */
function cariAkunInternal_(noHp, pin) {
  const akun = sheetToObjects_('AKUN_INTERNAL').find(function(a) {
    return String(a.No_HP) === String(noHp) && String(a.PIN) === String(pin);
  });
  if (!akun) return null;
  if (String(akun.Status).toLowerCase() !== 'aktif') {
    throw new Error('Akun Anda berstatus non-aktif. Silakan hubungi HRD.');
  }
  return akun;
}

/** Menyimpan data sesi ke CacheService, mengembalikan token acak untuk dipegang client. */
function buatSesiToken_(dataSesi) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('sesi_' + token, JSON.stringify(dataSesi), DURASI_SESI_DETIK_);
  return token;
}

/** Mengambil kembali data sesi dari token. Mengembalikan null jika token kosong/tidak valid/kadaluarsa. */
function ambilSesiToken_(token) {
  if (!token) return null;
  const mentah = CacheService.getScriptCache().get('sesi_' + token);
  if (!mentah) return null;
  try { return JSON.parse(mentah); } catch (e) { return null; }
}

/**
 * Dipanggil dari client untuk memverifikasi token yang tersimpan di browser
 * (misalnya saat halaman baru selesai dimuat via link, sebagai pengecekan tambahan).
 */
function cekSesiToken(token) {
  return ambilSesiToken_(token);
}

/** Menghapus sesi lebih awal (dipakai tombol "Keluar", opsional). */
function logoutSesi(token) {
  if (token) CacheService.getScriptCache().remove('sesi_' + token);
  return { sukses: true };
}

/**
 * LOGIN UNIVERSAL -- titik masuk tunggal untuk SEMUA jenis pengguna
 * (Pekerja, PIC/Mandor, HRD, Admin), dipakai oleh Checkin.html, Approval.html,
 * dan Dashboard.html. Login dicek dulu ke akun internal; jika tidak cocok,
 * baru dicoba sebagai akun pekerja freelance.
 */
function loginUniversal(noHp, pin) {
  const akun = cariAkunInternal_(noHp, pin);
  if (akun) {
    const idLokasiList = parseLokasiDitangani_(akun.Lokasi_Ditangani);
    const dataSesi = { role: akun.Role, nama: akun.Nama, idAkun: akun.ID_Akun, idLokasiList: idLokasiList };
    const token = buatSesiToken_(dataSesi);
    return { role: akun.Role, nama: akun.Nama, idLokasiList: idLokasiList, token: token };
  }

  // Bukan akun internal -- coba sebagai pekerja (fungsi ini throw Error kalau benar2 tidak ketemu)
  const hasilPekerja = loginPekerja(noHp, pin);
  const token = buatSesiToken_({ role: 'Pekerja', nama: hasilPekerja.nama, idPekerja: hasilPekerja.idPekerja });
  hasilPekerja.role = 'Pekerja';
  hasilPekerja.token = token;
  return hasilPekerja;
}

/**
 * Dipanggil saat halaman dibuka via link yang membawa token sesi (?token=...),
 * supaya pengguna TIDAK perlu mengetik ulang No.HP+PIN saat pindah halaman
 * (Checkin -> Approval -> Dashboard). Mengembalikan data tampilan lengkap,
 * sama seperti hasil loginUniversal(), berdasarkan role yang tersimpan di sesi.
 */
function ambilDataTampilanDariToken(token) {
  const sesi = ambilSesiToken_(token);
  if (!sesi) throw new Error('Sesi telah berakhir. Silakan login ulang.');

  if (sesi.role === 'Pekerja') {
    const semuaPekerja = sheetToObjects_('PEKERJA');
    const pekerja = semuaPekerja.find(function(p) { return p.ID_Pekerja === sesi.idPekerja; });
    if (!pekerja) throw new Error('Data pekerja tidak ditemukan.');
    const semuaLokasi = sheetToObjects_('LOKASI');
    const lokasi = semuaLokasi.find(function(l) { return l.ID_Lokasi === pekerja.ID_Lokasi; });
    return {
      role: 'Pekerja', token: token,
      idPekerja: pekerja.ID_Pekerja, nama: pekerja.Nama,
      posisi: pekerja.Posisi_Standar || pekerja.Jenis_Pekerjaan || '-',
      lokasi: lokasi ? { id: lokasi.ID_Lokasi, nama: lokasi.Nama_Proyek, radius: lokasi.Radius_Meter } : null,
      statusHariIni: getStatusPresensiHariIni_(pekerja.ID_Pekerja)
    };
  }

  // PIC / HRD / Admin
  return { role: sesi.role, token: token, nama: sesi.nama, idLokasiList: sesi.idLokasiList };
}

function getStatusPresensiHariIni_(idPekerja) {
  const tanggalHariIni = formatTanggal_(new Date());
  const semuaPresensi = sheetToObjects_('PRESENSI');
  const rowHariIni = semuaPresensi.find(function(p) {
    return p.ID_Pekerja === idPekerja && formatTanggal_(new Date(p.Tanggal)) === tanggalHariIni;
  });

  if (!rowHariIni) return { sudahCheckIn: false, sudahCheckOut: false };
  return {
    sudahCheckIn: true,
    sudahCheckOut: !!rowHariIni.Jam_CheckOut,
    jamCheckIn: rowHariIni.Jam_CheckIn,
    jamCheckOut: rowHariIni.Jam_CheckOut || null
  };
}

function doCheckIn(idPekerja, lat, lng) {
  const semuaPekerja = sheetToObjects_('PEKERJA');
  const pekerja = semuaPekerja.find(function(p) { return p.ID_Pekerja === idPekerja; });
  if (!pekerja) throw new Error('Data pekerja tidak ditemukan.');

  const statusHariIni = getStatusPresensiHariIni_(idPekerja);
  if (statusHariIni.sudahCheckIn) {
    throw new Error('Anda sudah melakukan Check-in hari ini pada jam ' + statusHariIni.jamCheckIn + '.');
  }

  const semuaLokasi = sheetToObjects_('LOKASI');
  const lokasi = semuaLokasi.find(function(l) { return l.ID_Lokasi === pekerja.ID_Lokasi; });
  if (!lokasi) throw new Error('Pekerja belum memiliki lokasi penugasan. Hubungi HRD.');

  const jarak = hitungJarakMeter_(Number(lat), Number(lng), Number(lokasi.Latitude), Number(lokasi.Longitude));
  const radius = Number(lokasi.Radius_Meter) || getConfig_().RADIUS_DEFAULT_METER;
  const anomali = jarak > radius;
  const statusCheckIn = anomali ? 'Di Luar Radius' : 'Valid';
  const statusApproval = anomali ? 'Perlu Approval' : 'Auto Approved';

  const now = new Date();
  const id = generateId_('PSN', 'PRESENSI');
  const sheet = getSheet_('PRESENSI');

  sheet.appendRow([
    id, pekerja.ID_Pekerja, pekerja.Nama, lokasi.ID_Lokasi, lokasi.Nama_Proyek,
    formatTanggal_(now), formatJam_(now), lat, lng, Math.round(jarak), statusCheckIn,
    '', '', '', '', '',
    '', '', '', '', '',
    anomali ? 'Ya' : 'Tidak', statusApproval, '', '', '',
    '', '', '', ''
  ]);

  if (anomali) {
    kirimEmailNotifikasi_(
      '⚠️ Anomali Check-in: ' + pekerja.Nama + ' - ' + lokasi.Nama_Proyek,
      'Pekerja ' + pekerja.Nama + ' melakukan Check-in di luar radius lokasi proyek.\n\n' +
      'Lokasi: ' + lokasi.Nama_Proyek + '\n' +
      'Waktu: ' + formatJam_(now) + ' (' + formatTanggal_(now) + ')\n' +
      'Jarak dari titik proyek: ' + Math.round(jarak) + ' meter (radius toleransi: ' + radius + ' meter)\n\n' +
      'Presensi ini memerlukan approval manual di halaman Approval.\n\n' +
      '(Email otomatis dari Sistem TKF PT Japa Indotama)',
      lokasi.ID_Lokasi
    );
  }

  return {
    sukses: true,
    anomali: anomali,
    jarak: Math.round(jarak),
    pesan: anomali
      ? 'Check-in berhasil, namun lokasi Anda berada ' + Math.round(jarak) + 'm dari titik proyek (di luar radius ' + radius + 'm). Presensi ini akan ditinjau oleh PIC/Mandor.'
      : 'Check-in berhasil pukul ' + formatJam_(now) + '. Selamat bekerja!'
  };
}

function doCheckOut(idPekerja, lat, lng) {
  const tanggalHariIni = formatTanggal_(new Date());
  const sheet = getSheet_('PRESENSI');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Belum ada data check-in hari ini.');

  const header = HEADERS.PRESENSI;
  const data = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();

  let rowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowIdPekerja = row[header.indexOf('ID_Pekerja')];
    const rowTanggal = formatTanggal_(new Date(row[header.indexOf('Tanggal')]));
    const rowJamCheckOut = row[header.indexOf('Jam_CheckOut')];
    if (rowIdPekerja === idPekerja && rowTanggal === tanggalHariIni && !rowJamCheckOut) {
      rowIndex = i;
      break;
    }
  }
  if (rowIndex === -1) {
    throw new Error('Anda belum Check-in hari ini, atau sudah melakukan Check-out sebelumnya.');
  }

  const row = data[rowIndex];
  const sheetRowNumber = rowIndex + 2;

  const semuaPekerja = sheetToObjects_('PEKERJA');
  const pekerja = semuaPekerja.find(function(p) { return p.ID_Pekerja === idPekerja; });
  const semuaLokasi = sheetToObjects_('LOKASI');
  const lokasi = semuaLokasi.find(function(l) { return l.ID_Lokasi === pekerja.ID_Lokasi; });

  const config = getConfig_();
  const jarak = hitungJarakMeter_(Number(lat), Number(lng), Number(lokasi.Latitude), Number(lokasi.Longitude));
  const radius = Number(lokasi.Radius_Meter) || config.RADIUS_DEFAULT_METER;
  const anomaliCheckOut = jarak > radius;
  const statusCheckOut = anomaliCheckOut ? 'Di Luar Radius' : 'Valid';

  const jamCheckInStr = row[header.indexOf('Jam_CheckIn')];
  const tanggalStr = row[header.indexOf('Tanggal')];
  const waktuCheckIn = new Date(tanggalStr + ' ' + jamCheckInStr);
  const waktuCheckOut = new Date();

  let totalJamKerja = (waktuCheckOut - waktuCheckIn) / (1000 * 60 * 60);
  totalJamKerja = Math.round(totalJamKerja * 100) / 100;

  const jamLembur = Math.max(0, totalJamKerja - config.JAM_KERJA_STANDAR);
  const jamLemburDibulatkan = Math.round(jamLembur * 100) / 100;

  const tanggalObj = new Date(tanggalStr);
  const libur = isHariLibur_(tanggalObj);
  const faktor = libur ? config.FAKTOR_HARI_LIBUR : 1;

  const tarifHarianDasar = Number(pekerja.Tarif_Harian) || 0;
  const tarifPerJamDasar = Number(pekerja.Tarif_Per_Jam) || Math.round(tarifHarianDasar / config.JAM_KERJA_STANDAR);

  const tarifHarianEfektif = tarifHarianDasar * faktor;
  const tarifPerJamEfektif = tarifPerJamDasar * faktor;

  const upahHarian = Math.round(tarifHarianEfektif);
  const upahLembur = Math.round(jamLemburDibulatkan * tarifPerJamEfektif);
  const totalUpah = upahHarian + upahLembur;

  const uangMakan = Number(pekerja.Uang_Makan_Harian) || 0;
  const uangTransport = Number(pekerja.Uang_Transport_Harian) || 0;
  const sarapanDisediakan = lokasi.Sarapan_Disediakan;
  const uangSarapan = (String(sarapanDisediakan).toLowerCase() === 'tidak') ? config.UANG_SARAPAN_DEFAULT : 0;

  const anomaliCheckInSebelumnya = row[header.indexOf('Status_Anomali')] === 'Ya';
  const anomaliGabungan = anomaliCheckInSebelumnya || anomaliCheckOut;
  const statusApprovalSaatIni = row[header.indexOf('Status_Approval')];
  const statusApprovalBaru = (statusApprovalSaatIni === 'Auto Approved' && anomaliCheckOut)
    ? 'Perlu Approval'
    : statusApprovalSaatIni;

  sheet.getRange(sheetRowNumber, header.indexOf('Jam_CheckOut') + 1, 1, 15).setValues([[
    formatJam_(waktuCheckOut), lat, lng, Math.round(jarak), statusCheckOut,
    totalJamKerja, jamLemburDibulatkan, upahHarian, upahLembur, totalUpah,
    anomaliGabungan ? 'Ya' : 'Tidak', statusApprovalBaru,
    row[header.indexOf('Catatan_Approval')] || '',
    row[header.indexOf('Approved_By')] || '',
    row[header.indexOf('Approved_At')] || ''
  ]]);

  sheet.getRange(sheetRowNumber, header.indexOf('Tipe_Hari') + 1, 1, 4).setValues([[
    libur ? 'Libur' : 'Normal', uangMakan, uangTransport, uangSarapan
  ]]);

  if (anomaliCheckOut) {
    kirimEmailNotifikasi_(
      '⚠️ Anomali Check-out: ' + pekerja.Nama + ' - ' + lokasi.Nama_Proyek,
      'Pekerja ' + pekerja.Nama + ' melakukan Check-out di luar radius lokasi proyek.\n\n' +
      'Lokasi: ' + lokasi.Nama_Proyek + '\n' +
      'Waktu: ' + formatJam_(waktuCheckOut) + ' (' + formatTanggal_(waktuCheckOut) + ')\n' +
      'Jarak dari titik proyek: ' + Math.round(jarak) + ' meter (radius toleransi: ' + radius + ' meter)\n\n' +
      'Presensi ini memerlukan approval manual di halaman Approval.\n\n' +
      '(Email otomatis dari Sistem TKF PT Japa Indotama)',
      lokasi.ID_Lokasi
    );
  }

  return {
    sukses: true,
    anomali: anomaliCheckOut,
    totalJamKerja: totalJamKerja,
    jamLembur: jamLemburDibulatkan,
    totalUpah: totalUpah,
    pesan: anomaliCheckOut
      ? 'Check-out berhasil, namun lokasi Anda di luar radius proyek. Presensi ini akan ditinjau PIC/Mandor.'
      : 'Check-out berhasil pukul ' + formatJam_(waktuCheckOut) + '. Total jam kerja: ' + totalJamKerja + ' jam.' + (libur ? ' (Hari ini terhitung HARI LIBUR, upah dihitung 2x lipat.)' : '')
  };
}

function getRiwayatPresensiSaya(idPekerja, jumlahHari) {
  const batasHari = jumlahHari || 14;
  const batasTanggal = new Date();
  batasTanggal.setDate(batasTanggal.getDate() - batasHari);

  const semuaPresensi = sheetToObjects_('PRESENSI').filter(function(p) {
    return p.ID_Pekerja === idPekerja && new Date(p.Tanggal) >= batasTanggal;
  });
  semuaPresensi.sort(function(a, b) { return new Date(b.Tanggal) - new Date(a.Tanggal); });

  return semuaPresensi.map(function(p) {
    return {
      tanggal: p.Tanggal,
      jamCheckIn: p.Jam_CheckIn,
      jamCheckOut: p.Jam_CheckOut || '-',
      statusCheckIn: p.Status_CheckIn,
      statusCheckOut: p.Status_CheckOut || '-',
      statusApproval: p.Status_Approval,
      totalJamKerja: p.Total_Jam_Kerja || 0,
      tipeHari: p.Tipe_Hari || 'Normal'
    };
  });
}


// ============================================================
// BAGIAN 9 (TKF-04): VALIDASI & APPROVAL KEHADIRAN ANOMALI
// ============================================================

/**
 * Mengambil daftar presensi yang perlu approval.
 * - daftarIdLokasi (array ID_Lokasi, opsional): kalau diisi, HANYA presensi di
 *   lokasi-lokasi itu yang ditampilkan -- dipakai untuk PIC yang sudah login
 *   lewat sesi (jadi tidak perlu ketik nama manual lagi, dan tidak mungkin salah lokasi).
 * - namaPIC (opsional, cara lama): dipertahankan untuk kompatibilitas/filter manual HRD.
 */
function getDaftarPresensiPerluApproval(namaPIC, daftarIdLokasi) {
  const semuaPresensi = sheetToObjects_('PRESENSI');
  let hasil = semuaPresensi.filter(function(p) { return p.Status_Approval === 'Perlu Approval'; });

  if (daftarIdLokasi && daftarIdLokasi.length > 0) {
    hasil = hasil.filter(function(p) { return daftarIdLokasi.indexOf(p.ID_Lokasi) !== -1; });
  } else if (namaPIC) {
    const semuaLokasi = sheetToObjects_('LOKASI');
    const idLokasiPIC = semuaLokasi
      .filter(function(l) { return String(l.PIC_Nama).toLowerCase() === String(namaPIC).toLowerCase(); })
      .map(function(l) { return l.ID_Lokasi; });
    hasil = hasil.filter(function(p) { return idLokasiPIC.indexOf(p.ID_Lokasi) !== -1; });
  }

  hasil.sort(function(a, b) { return new Date(b.Tanggal) - new Date(a.Tanggal); });
  return hasil;
}

function approvePresensi(idPresensi, keputusan, catatan, namaApprover) {
  const sheet = getSheet_('PRESENSI');
  const lastRow = sheet.getLastRow();
  const header = HEADERS.PRESENSI;
  const data = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();

  const idxId = header.indexOf('ID_Presensi');
  const rowIndex = data.findIndex(function(row) { return row[idxId] === idPresensi; });
  if (rowIndex === -1) throw new Error('Data presensi tidak ditemukan.');

  const sheetRowNumber = rowIndex + 2;
  const statusBaru = (keputusan === 'approve') ? 'Approved' : 'Rejected';

  if (keputusan === 'reject') {
    sheet.getRange(sheetRowNumber, header.indexOf('Upah_Harian') + 1, 1, 3).setValues([[0, 0, 0]]);
  }

  sheet.getRange(sheetRowNumber, header.indexOf('Status_Approval') + 1, 1, 3).setValues([[
    statusBaru, catatan || '', namaApprover || ''
  ]]);
  sheet.getRange(sheetRowNumber, header.indexOf('Approved_At') + 1)
    .setValue(formatJam_(new Date()) + ' ' + formatTanggal_(new Date()));

  return { sukses: true, statusBaru: statusBaru };
}

/**
 * Versi BULK dari approvePresensi — memproses banyak ID_Presensi sekaligus
 * dalam SATU pemanggilan dari client (lebih cepat, tidak perlu banyak round-trip).
 * Dipakai oleh mode "Pilih Banyak" di halaman Approval. Setiap item diproses
 * dalam try/catch terpisah, supaya 1 item gagal TIDAK menggagalkan item lainnya.
 */
function approvePresensiBulk(daftarId, keputusan, catatan, namaApprover) {
  let jumlahBerhasil = 0;
  let jumlahGagal = 0;
  const pesanGagal = [];

  daftarId.forEach(function(id) {
    try {
      approvePresensi(id, keputusan, catatan, namaApprover);
      jumlahBerhasil++;
    } catch (err) {
      jumlahGagal++;
      pesanGagal.push(id + ': ' + err.message);
    }
  });

  return { sukses: true, jumlahBerhasil: jumlahBerhasil, jumlahGagal: jumlahGagal, pesanGagal: pesanGagal };
}

function simpanLampiran_(base64Data, mimeType, namaFile) {
  if (!base64Data) return '';
  const folders = DriveApp.getFoldersByName('Lampiran_TKF_JapaIndotama');
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('Lampiran_TKF_JapaIndotama');
  const dataBersih = base64Data.indexOf(',') !== -1 ? base64Data.split(',')[1] : base64Data;
  const bytesDecoded = Utilities.base64Decode(dataBersih);
  const blob = Utilities.newBlob(bytesDecoded, mimeType || 'image/jpeg', namaFile);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function getDaftarPekerjaUntukPIC(namaPIC) {
  const semuaPekerja = sheetToObjects_('PEKERJA').filter(function(p) {
    return String(p.Status).toLowerCase() === 'aktif';
  });

  if (!namaPIC) {
    return semuaPekerja.map(function(p) { return { id: p.ID_Pekerja, nama: p.Nama }; });
  }

  const semuaLokasi = sheetToObjects_('LOKASI');
  const idLokasiPIC = semuaLokasi
    .filter(function(l) { return String(l.PIC_Nama).toLowerCase() === String(namaPIC).toLowerCase(); })
    .map(function(l) { return l.ID_Lokasi; });

  return semuaPekerja
    .filter(function(p) { return idLokasiPIC.indexOf(p.ID_Lokasi) !== -1; })
    .map(function(p) { return { id: p.ID_Pekerja, nama: p.Nama }; });
}

function ajukanIzinLembur(data) {
  if (!data.idPekerja || !data.jenisPengajuan || !data.tanggalBerlaku) {
    throw new Error('Pekerja, jenis pengajuan, dan tanggal wajib diisi.');
  }

  const semuaPekerja = sheetToObjects_('PEKERJA');
  const pekerja = semuaPekerja.find(function(p) { return p.ID_Pekerja === data.idPekerja; });
  if (!pekerja) throw new Error('Data pekerja tidak ditemukan.');

  const semuaLokasi = sheetToObjects_('LOKASI');
  const lokasi = semuaLokasi.find(function(l) { return l.ID_Lokasi === pekerja.ID_Lokasi; });

  let lampiranUrl = '';
  if (data.lampiranBase64) {
    const namaFile = 'Lampiran_' + pekerja.Nama.replace(/\s+/g, '_') + '_' + new Date().getTime();
    lampiranUrl = simpanLampiran_(data.lampiranBase64, data.lampiranMimeType, namaFile);
  }

  const id = generateId_('IZL', 'IZIN_LEMBUR');
  const sheet = getSheet_('IZIN_LEMBUR');
  sheet.appendRow([
    id, pekerja.ID_Pekerja, pekerja.Nama, pekerja.ID_Lokasi, lokasi ? lokasi.Nama_Proyek : '',
    data.jenisPengajuan, data.kategoriIzin || '', data.tanggalBerlaku, data.estimasiJamLembur || '',
    data.keterangan || '', lampiranUrl, data.diinputOleh || 'Pekerja',
    'Menunggu', '', '', '', formatTanggal_(new Date())
  ]);

  kirimEmailNotifikasi_(
    '📝 Pengajuan ' + data.jenisPengajuan + ' Baru: ' + pekerja.Nama,
    pekerja.Nama + ' mengajukan ' + data.jenisPengajuan + ' untuk tanggal ' + data.tanggalBerlaku + '.\n\n' +
    'Lokasi: ' + (lokasi ? lokasi.Nama_Proyek : '-') + '\n' +
    (data.jenisPengajuan === 'Izin' ? 'Kategori: ' + (data.kategoriIzin || '-') + '\n' : 'Estimasi jam lembur: ' + (data.estimasiJamLembur || '-') + ' jam\n') +
    'Keterangan: ' + (data.keterangan || '-') + '\n' +
    'Diajukan oleh: ' + (data.diinputOleh || 'Pekerja') + '\n\n' +
    'Silakan buka halaman Approval untuk memproses pengajuan ini.\n\n' +
    '(Email otomatis dari Sistem TKF PT Japa Indotama)',
    pekerja.ID_Lokasi
  );

  return { sukses: true, id: id };
}


// ============================================================
// BAGIAN 11 (TKF-06): APPROVAL IZIN & LEMBUR
// ============================================================

function getDaftarPengajuanPerluApproval(namaPIC, daftarIdLokasi) {
  let hasil = sheetToObjects_('IZIN_LEMBUR').filter(function(p) { return p.Status_Approval === 'Menunggu'; });

  if (daftarIdLokasi && daftarIdLokasi.length > 0) {
    hasil = hasil.filter(function(p) { return daftarIdLokasi.indexOf(p.ID_Lokasi) !== -1; });
  } else if (namaPIC) {
    const semuaLokasi = sheetToObjects_('LOKASI');
    const idLokasiPIC = semuaLokasi
      .filter(function(l) { return String(l.PIC_Nama).toLowerCase() === String(namaPIC).toLowerCase(); })
      .map(function(l) { return l.ID_Lokasi; });
    hasil = hasil.filter(function(p) { return idLokasiPIC.indexOf(p.ID_Lokasi) !== -1; });
  }

  hasil.sort(function(a, b) { return new Date(b.Tanggal_Pengajuan) - new Date(a.Tanggal_Pengajuan); });
  return hasil;
}

function approvePengajuan(idPengajuan, keputusan, catatan, namaApprover) {
  const sheet = getSheet_('IZIN_LEMBUR');
  const lastRow = sheet.getLastRow();
  const header = HEADERS.IZIN_LEMBUR;
  const data = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();

  const idxId = header.indexOf('ID_Pengajuan');
  const rowIndex = data.findIndex(function(row) { return row[idxId] === idPengajuan; });
  if (rowIndex === -1) throw new Error('Data pengajuan tidak ditemukan.');

  const sheetRowNumber = rowIndex + 2;
  const statusBaru = (keputusan === 'approve') ? 'Approved' : 'Rejected';

  sheet.getRange(sheetRowNumber, header.indexOf('Status_Approval') + 1, 1, 3).setValues([[
    statusBaru, catatan || '', namaApprover || ''
  ]]);
  sheet.getRange(sheetRowNumber, header.indexOf('Approved_At') + 1)
    .setValue(formatJam_(new Date()) + ' ' + formatTanggal_(new Date()));

  return { sukses: true, statusBaru: statusBaru };
}

/**
 * Versi BULK dari approvePengajuan — sama seperti approvePresensiBulk,
 * dipakai oleh mode "Pilih Banyak" untuk tab Izin & Lembur.
 */
function approvePengajuanBulk(daftarId, keputusan, catatan, namaApprover) {
  let jumlahBerhasil = 0;
  let jumlahGagal = 0;
  const pesanGagal = [];

  daftarId.forEach(function(id) {
    try {
      approvePengajuan(id, keputusan, catatan, namaApprover);
      jumlahBerhasil++;
    } catch (err) {
      jumlahGagal++;
      pesanGagal.push(id + ': ' + err.message);
    }
  });

  return { sukses: true, jumlahBerhasil: jumlahBerhasil, jumlahGagal: jumlahGagal, pesanGagal: pesanGagal };
}


// ============================================================
// BAGIAN 12 (TKF-10): NOTIFIKASI EMAIL OTOMATIS
// ============================================================

function kirimEmailNotifikasi_(subjek, isi, idLokasi) {
  const config = getConfig_();
  let daftarEmail = [];

  if (config.EMAIL_HRD) {
    daftarEmail = daftarEmail.concat(
      config.EMAIL_HRD.split(',').map(function(e) { return e.trim(); }).filter(Boolean)
    );
  }

  if (idLokasi) {
    const semuaLokasi = sheetToObjects_('LOKASI');
    const lokasi = semuaLokasi.find(function(l) { return l.ID_Lokasi === idLokasi; });
    if (lokasi && lokasi.PIC_Email) {
      daftarEmail.push(String(lokasi.PIC_Email).trim());
    }
  }

  daftarEmail = daftarEmail.filter(function(e, i) { return e && daftarEmail.indexOf(e) === i; });
  if (daftarEmail.length === 0) return;

  try {
    MailApp.sendEmail({ to: daftarEmail.join(','), subject: subjek, body: isi });
  } catch (err) {
    console.error('Gagal mengirim email notifikasi: ' + err.message);
  }
}

function reminderBelumCheckIn() {
  const tanggalHariIni = formatTanggal_(new Date());
  const semuaPekerja = sheetToObjects_('PEKERJA').filter(function(p) {
    return String(p.Status).toLowerCase() === 'aktif';
  });
  const semuaPresensiHariIni = sheetToObjects_('PRESENSI').filter(function(p) {
    return formatTanggal_(new Date(p.Tanggal)) === tanggalHariIni;
  });
  const idSudahCheckIn = semuaPresensiHariIni.map(function(p) { return p.ID_Pekerja; });
  const belumCheckIn = semuaPekerja.filter(function(p) { return idSudahCheckIn.indexOf(p.ID_Pekerja) === -1; });

  if (belumCheckIn.length === 0) return;

  const semuaLokasi = sheetToObjects_('LOKASI');
  const grupLokasi = {};
  belumCheckIn.forEach(function(p) {
    const key = p.ID_Lokasi || '(tanpa lokasi)';
    if (!grupLokasi[key]) grupLokasi[key] = [];
    grupLokasi[key].push(p.Nama);
  });

  Object.keys(grupLokasi).forEach(function(idLokasi) {
    const lokasi = semuaLokasi.find(function(l) { return l.ID_Lokasi === idLokasi; });
    const namaLokasi = lokasi ? lokasi.Nama_Proyek : '(Lokasi belum diatur)';
    const daftarNama = grupLokasi[idLokasi];
    const isi =
      'Berikut pekerja yang BELUM check-in hari ini (' + tanggalHariIni + ') di lokasi ' + namaLokasi + ':\n\n' +
      daftarNama.map(function(n) { return '- ' + n; }).join('\n') +
      '\n\nMohon segera ditindaklanjuti.\n\n(Email otomatis dari Sistem TKF PT Japa Indotama)';
    kirimEmailNotifikasi_(
      '⏰ Reminder: ' + daftarNama.length + ' Pekerja Belum Check-in - ' + namaLokasi,
      isi,
      idLokasi === '(tanpa lokasi)' ? null : idLokasi
    );
  });
}

function pasangTriggerReminder() {
  const triggers = ScriptApp.getProjectTriggers();
  const sudahAda = triggers.some(function(t) { return t.getHandlerFunction() === 'reminderBelumCheckIn'; });
  if (sudahAda) {
    SpreadsheetApp.getUi().alert('Reminder otomatis SUDAH AKTIF sebelumnya.');
    return;
  }
  const config = getConfig_();
  ScriptApp.newTrigger('reminderBelumCheckIn').timeBased().atHour(config.JAM_REMINDER).everyDays(1).create();
  SpreadsheetApp.getUi().alert(
    'Reminder Otomatis Aktif ✅',
    'Setiap hari sekitar jam ' + config.JAM_REMINDER + ':00, sistem akan mengecek pekerja yang belum check-in dan mengirim email ke HRD & PIC terkait.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function hapusTriggerReminder() {
  const triggers = ScriptApp.getProjectTriggers();
  let dihapus = 0;
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'reminderBelumCheckIn') { ScriptApp.deleteTrigger(t); dihapus++; }
  });
  SpreadsheetApp.getUi().alert(dihapus > 0 ? 'Reminder otomatis berhasil dimatikan.' : 'Tidak ada reminder otomatis yang sedang aktif.');
}


// ============================================================
// BAGIAN 13 (TKF-08): DASHBOARD MONITORING REAL-TIME
// ============================================================

function getDashboardData() {
  const tanggalHariIni = formatTanggal_(new Date());
  const semuaPekerja = sheetToObjects_('PEKERJA').filter(function(p) {
    return String(p.Status).toLowerCase() === 'aktif';
  });
  const semuaPresensi = sheetToObjects_('PRESENSI');
  const semuaPresensiHariIni = semuaPresensi.filter(function(p) {
    return formatTanggal_(new Date(p.Tanggal)) === tanggalHariIni;
  });
  const semuaLokasi = sheetToObjects_('LOKASI').filter(function(l) {
    return String(l.Status).toLowerCase() === 'aktif';
  });

  const perLokasi = semuaLokasi.map(function(lok) {
    const pekerjaLokasi = semuaPekerja.filter(function(p) { return p.ID_Lokasi === lok.ID_Lokasi; });
    const presensiLokasi = semuaPresensiHariIni.filter(function(p) { return p.ID_Lokasi === lok.ID_Lokasi; });
    return {
      namaLokasi: lok.Nama_Proyek,
      totalPekerja: pekerjaLokasi.length,
      sudahCheckIn: presensiLokasi.length,
      belumCheckIn: Math.max(0, pekerjaLokasi.length - presensiLokasi.length),
      anomali: presensiLokasi.filter(function(p) { return p.Status_Anomali === 'Ya'; }).length
    };
  });

  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const tgl = formatTanggal_(d);
    const rowsHariItu = semuaPresensi.filter(function(p) { return formatTanggal_(new Date(p.Tanggal)) === tgl; });
    const totalJam = rowsHariItu.reduce(function(sum, r) { return sum + (Number(r.Total_Jam_Kerja) || 0); }, 0);
    trend.push({ tanggal: tgl, jumlahHadir: rowsHariItu.length, totalJamKerja: Math.round(totalJam * 100) / 100 });
  }

  return {
    tanggalHariIni: tanggalHariIni,
    totalPekerjaAktif: semuaPekerja.length,
    totalSudahCheckIn: semuaPresensiHariIni.length,
    totalBelumCheckIn: Math.max(0, semuaPekerja.length - semuaPresensiHariIni.length),
    totalAnomaliHariIni: semuaPresensiHariIni.filter(function(p) { return p.Status_Anomali === 'Ya'; }).length,
    perLokasi: perLokasi,
    trend: trend
  };
}


// ============================================================
// BAGIAN 14 (TKF-09): REKAP UPAH & EXPORT PDF
// ============================================================

function showFormRekap() {
  bukaDialog_('FormRekap', 'Buat Rekap Timesheet', 420, 480);
}

function showFormExportTimesheet() {
  bukaDialog_('FormExportTimesheet', 'Export Timesheet PDF', 420, 420);
}

function showFormHariLibur() {
  bukaDialog_('FormHariLibur', 'Kelola Hari Libur', 400, 440);
}

function tambahHariLibur(tanggal, keterangan) {
  if (!tanggal) throw new Error('Tanggal wajib diisi.');
  const sheet = getSheet_('HARI_LIBUR');
  sheet.appendRow([tanggal, keterangan || '']);
  return { sukses: true };
}

/** Mengambil daftar hari libur tambahan (tanggal merah/cuti bersama) yang tersimpan manual. */
function getDaftarHariLibur() {
  return sheetToObjects_('HARI_LIBUR');
}

function generateRekap(tanggalMulai, tanggalSelesai) {
  const semuaPresensi = sheetToObjects_('PRESENSI');

  const dataValid = semuaPresensi.filter(function(p) {
    const tgl = formatTanggal_(new Date(p.Tanggal));
    const statusOk = (p.Status_Approval === 'Auto Approved' || p.Status_Approval === 'Approved');
    const sudahCheckout = !!p.Jam_CheckOut;
    return tgl >= tanggalMulai && tgl <= tanggalSelesai && statusOk && sudahCheckout;
  });

  if (dataValid.length === 0) {
    throw new Error('Tidak ada data presensi valid pada rentang tanggal tersebut.');
  }

  const grup = {};
  dataValid.forEach(function(p) {
    const key = p.ID_Pekerja + '|' + p.ID_Lokasi;
    if (!grup[key]) {
      grup[key] = {
        idPekerja: p.ID_Pekerja, nama: p.Nama_Pekerja, idLokasi: p.ID_Lokasi, namaLokasi: p.Nama_Lokasi,
        totalHari: 0, totalJamKerja: 0, totalJamLembur: 0,
        totalUpahHarian: 0, totalUpahLembur: 0,
        totalMakan: 0, totalTransport: 0, totalSarapan: 0
      };
    }
    const g = grup[key];
    g.totalHari += 1;
    g.totalJamKerja += Number(p.Total_Jam_Kerja) || 0;
    g.totalJamLembur += Number(p.Jam_Lembur) || 0;
    g.totalUpahHarian += Number(p.Upah_Harian) || 0;
    g.totalUpahLembur += Number(p.Upah_Lembur) || 0;
    g.totalMakan += Number(p.Uang_Makan) || 0;
    g.totalTransport += Number(p.Uang_Transport) || 0;
    g.totalSarapan += Number(p.Uang_Sarapan) || 0;
  });

  const sheet = getSheet_('REKAP');
  const periode = tanggalMulai + ' s/d ' + tanggalSelesai;
  const tanggalGenerate = formatTanggal_(new Date());
  const startRow = sheet.getLastRow() + 1;

  const rows = Object.keys(grup).map(function(key) {
    const g = grup[key];
    const id = 'RKP-' + new Date().getTime().toString().slice(-6) + '-' + Math.floor(Math.random() * 900 + 100);
    const totalUpah = Math.round(g.totalUpahHarian + g.totalUpahLembur);
    const grandTotal = Math.round(totalUpah + g.totalMakan + g.totalTransport + g.totalSarapan);
    return [
      id, periode, g.idPekerja, g.nama, g.idLokasi, g.namaLokasi,
      g.totalHari, Math.round(g.totalJamKerja * 100) / 100, Math.round(g.totalJamLembur * 100) / 100,
      Math.round(g.totalUpahHarian), Math.round(g.totalUpahLembur), totalUpah, tanggalGenerate,
      Math.round(g.totalMakan), Math.round(g.totalTransport), Math.round(g.totalSarapan), grandTotal,
      0, ''
    ];
  });
  sheet.getRange(startRow, 1, rows.length, HEADERS.REKAP.length).setValues(rows);

  const kolomGrandTotal = HEADERS.REKAP.indexOf('Grand_Total') + 1;
  const kolomKasbon = HEADERS.REKAP.indexOf('Kasbon') + 1;
  const kolomSisaUpah = HEADERS.REKAP.indexOf('Sisa_Upah') + 1;
  for (let i = 0; i < rows.length; i++) {
    const baris = startRow + i;
    sheet.getRange(baris, kolomSisaUpah).setFormula(
      '=' + columnToLetter_(kolomGrandTotal) + baris + '-' + columnToLetter_(kolomKasbon) + baris
    );
  }

  return {
    sukses: true,
    jumlahPekerja: rows.length,
    totalUpahKeseluruhan: rows.reduce(function(sum, r) { return sum + r[16]; }, 0),
    periode: periode
  };
}

// ============================================================
// KASBON: FORM INPUT TERPISAH (menggantikan edit-sel-langsung di db_rekap)
// ============================================================

/** Membuka dialog form untuk mengisi Kasbon per pekerja. */
function showFormKasbon() {
  bukaDialog_('FormKasbon', 'Isi Kasbon', 460, 560);
}

/**
 * Mengambil daftar baris db_rekap untuk dipilih di form Kasbon.
 * Jika periode diisi, hasil difilter berdasarkan teks Periode (boleh sebagian).
 * Jika kosong, tampilkan 60 baris paling baru (berdasarkan Tanggal_Generate).
 */
function getDaftarRekapUntukKasbon(periode) {
  let hasil = sheetToObjects_('REKAP');
  if (periode) {
    hasil = hasil.filter(function(r) { return String(r.Periode).indexOf(periode) !== -1; });
  }
  hasil.sort(function(a, b) { return new Date(b.Tanggal_Generate) - new Date(a.Tanggal_Generate); });
  return hasil.slice(0, 60).map(function(r) {
    return {
      idRekap: r.ID_Rekap,
      periode: r.Periode,
      nama: r.Nama_Pekerja,
      lokasi: r.Nama_Lokasi,
      grandTotal: Number(r.Grand_Total) || 0,
      kasbonSaatIni: Number(r.Kasbon) || 0
    };
  });
}

/**
 * Menyimpan nilai Kasbon baru untuk satu baris rekap tertentu.
 * Divalidasi: harus angka >= 0, dan tidak boleh melebihi Grand_Total baris itu.
 * Sisa_Upah tidak perlu ditulis ulang di sini karena kolom itu berisi RUMUS
 * (=Grand_Total - Kasbon) yang otomatis terhitung ulang begitu Kasbon berubah.
 */
function simpanKasbon(idRekap, kasbonBaru) {
  const sheet = getSheet_('REKAP');
  const lastRow = sheet.getLastRow();
  const header = HEADERS.REKAP;
  const data = sheet.getRange(2, 1, lastRow - 1, header.length).getValues();

  const idxId = header.indexOf('ID_Rekap');
  const rowIndex = data.findIndex(function(row) { return row[idxId] === idRekap; });
  if (rowIndex === -1) throw new Error('Data rekap tidak ditemukan. Coba muat ulang daftar.');

  const kasbon = Number(kasbonBaru);
  if (isNaN(kasbon) || kasbon < 0) {
    throw new Error('Kasbon harus berupa angka 0 atau lebih.');
  }

  const grandTotal = Number(data[rowIndex][header.indexOf('Grand_Total')]) || 0;
  if (kasbon > grandTotal) {
    throw new Error(
      'Kasbon (Rp' + kasbon.toLocaleString('id-ID') + ') tidak boleh melebihi Grand Total pekerja ini (Rp' + grandTotal.toLocaleString('id-ID') + ').'
    );
  }

  const sheetRowNumber = rowIndex + 2;
  sheet.getRange(sheetRowNumber, header.indexOf('Kasbon') + 1).setValue(kasbon);

  return { sukses: true, kasbonBaru: kasbon, sisaUpah: grandTotal - kasbon };
}


function getOrCreateFolderLaporan_() {
  const nama = 'Laporan_TKF_JapaIndotama';
  const folders = DriveApp.getFoldersByName(nama);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(nama);
}

function exportSheetKePdf_(sheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gid = sheet.getSheetId();
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export' +
    '?format=pdf&gid=' + gid + '&portrait=false&fitw=true&gridlines=false&printtitle=false&sheetnames=false';
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const blob = response.getBlob().setName(sheet.getName() + '.pdf');
  const folder = getOrCreateFolderLaporan_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function exportTimesheetPekerja(idPekerja, tanggalMulai, tanggalSelesai) {
  const semuaPekerja = sheetToObjects_('PEKERJA');
  const pekerja = semuaPekerja.find(function(p) { return p.ID_Pekerja === idPekerja; });
  if (!pekerja) throw new Error('Data pekerja tidak ditemukan.');

  const semuaPresensi = sheetToObjects_('PRESENSI').filter(function(p) {
    const tgl = formatTanggal_(new Date(p.Tanggal));
    return p.ID_Pekerja === idPekerja && tgl >= tanggalMulai && tgl <= tanggalSelesai && p.Jam_CheckOut;
  });
  semuaPresensi.sort(function(a, b) { return new Date(a.Tanggal) - new Date(b.Tanggal); });

  if (semuaPresensi.length === 0) {
    throw new Error('Tidak ada data presensi lengkap (sudah check-out) pada rentang tanggal ini untuk pekerja tersebut.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.insertSheet('TS_TEMP_' + new Date().getTime());
  const jamKerjaStd = getConfig_().JAM_KERJA_STANDAR;

  sheet.getRange('A1').setValue('PT JAPA INDOTAMA').setFontWeight('bold').setFontSize(15);
  sheet.getRange('A2').setValue('Komplek Industri De Prima Terra Blok F2 Kav.12, Bojongsoang, Kab. Bandung').setFontSize(9).setFontColor('#4A5A68');
  sheet.getRange('A4').setValue('TIME SHEET FREELANCE').setFontWeight('bold').setFontSize(13);
  sheet.getRange('A6').setValue('Nama'); sheet.getRange('B6').setValue(': ' + pekerja.Nama);
  sheet.getRange('A7').setValue('Posisi'); sheet.getRange('B7').setValue(': ' + (pekerja.Posisi_Standar || pekerja.Jenis_Pekerjaan || '-'));
  sheet.getRange('A8').setValue('Periode'); sheet.getRange('B8').setValue(': ' + tanggalMulai + ' s/d ' + tanggalSelesai);

  const headerTabel = ['No','Tanggal','Tipe Hari','Jam Masuk','Jam Pulang','Total Jam Normal','Lembur Mulai','Lembur Selesai','Upah Harian','Upah/Jam','Upah Lembur','Uang Makan','Uang Transport','Uang Sarapan','Total'];
  const barisHeader = 10;
  sheet.getRange(barisHeader, 1, 1, headerTabel.length).setValues([headerTabel])
    .setFontWeight('bold').setBackground('#0B2545').setFontColor('#ffffff');

  let baris = barisHeader + 1;
  let totalUpahHarian = 0, totalUpahLembur = 0, totalMakan = 0, totalTransport = 0, totalSarapan = 0, totalKeseluruhan = 0;

  semuaPresensi.forEach(function(p, i) {
    const waktuCheckIn = new Date(p.Tanggal + ' ' + p.Jam_CheckIn);
    const waktuCheckOut = new Date(p.Tanggal + ' ' + p.Jam_CheckOut);
    const batasNormal = new Date(waktuCheckIn.getTime() + jamKerjaStd * 60 * 60 * 1000);
    const jamNormalSelesai = batasNormal < waktuCheckOut ? batasNormal : waktuCheckOut;
    const adaLembur = Number(p.Jam_Lembur) > 0;
    const fmtJam = function(d) { return Utilities.formatDate(d, CONFIG.ZONA_WAKTU, 'HH:mm'); };

    const upahHarian = Number(p.Upah_Harian) || 0;
    const upahLembur = Number(p.Upah_Lembur) || 0;
    const uangMakan = Number(p.Uang_Makan) || 0;
    const uangTransport = Number(p.Uang_Transport) || 0;
    const uangSarapan = Number(p.Uang_Sarapan) || 0;
    const totalHari = upahHarian + upahLembur + uangMakan + uangTransport + uangSarapan;

    sheet.getRange(baris, 1, 1, headerTabel.length).setValues([[
      i + 1, p.Tanggal, p.Tipe_Hari || 'Normal', p.Jam_CheckIn, fmtJam(jamNormalSelesai),
      Math.min(Number(p.Total_Jam_Kerja) || 0, jamKerjaStd),
      adaLembur ? fmtJam(batasNormal) : '-',
      adaLembur ? p.Jam_CheckOut : '-',
      upahHarian, jamKerjaStd > 0 ? Math.round(upahHarian / jamKerjaStd) : 0,
      upahLembur, uangMakan, uangTransport, uangSarapan, totalHari
    ]]);

    totalUpahHarian += upahHarian; totalUpahLembur += upahLembur;
    totalMakan += uangMakan; totalTransport += uangTransport; totalSarapan += uangSarapan;
    totalKeseluruhan += totalHari;
    baris++;
  });

  sheet.getRange(baris, 8).setValue('TOTAL').setFontWeight('bold');
  sheet.getRange(baris, 9).setValue(totalUpahHarian).setFontWeight('bold');
  sheet.getRange(baris, 11).setValue(totalUpahLembur).setFontWeight('bold');
  sheet.getRange(baris, 12).setValue(totalMakan).setFontWeight('bold');
  sheet.getRange(baris, 13).setValue(totalTransport).setFontWeight('bold');
  sheet.getRange(baris, 14).setValue(totalSarapan).setFontWeight('bold');
  sheet.getRange(baris, 15).setValue(totalKeseluruhan).setFontWeight('bold');
  sheet.autoResizeColumns(1, headerTabel.length);

  const url = exportSheetKePdf_(sheet);
  ss.deleteSheet(sheet);

  return { sukses: true, url: url, jumlahHari: semuaPresensi.length, totalKeseluruhan: totalKeseluruhan };
}

function exportRekapPdf(tanggalMulai, tanggalSelesai) {
  const periode = tanggalMulai + ' s/d ' + tanggalSelesai;
  const semuaRekap = sheetToObjects_('REKAP').filter(function(r) { return r.Periode === periode; });
  if (semuaRekap.length === 0) {
    throw new Error('Belum ada data rekap untuk periode ini. Jalankan "Buat Rekap Timesheet" dulu.');
  }

  const semuaPekerja = sheetToObjects_('PEKERJA');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.insertSheet('RK_TEMP_' + new Date().getTime());

  sheet.getRange('A1').setValue('PT JAPA INDOTAMA').setFontWeight('bold').setFontSize(15);
  sheet.getRange('A2').setValue('REKAP UPAH FREELANCE').setFontWeight('bold').setFontSize(13);
  sheet.getRange('A3').setValue('Periode: ' + periode);

  const headerTabel = ['No','Nama','Posisi','Lokasi','Hari Kerja','Total Upah','Kasbon','Sisa Upah'];
  const barisHeader = 5;
  sheet.getRange(barisHeader, 1, 1, headerTabel.length).setValues([headerTabel])
    .setFontWeight('bold').setBackground('#0B2545').setFontColor('#ffffff');

  let baris = barisHeader + 1;
  let grandTotal = 0, grandKasbon = 0, grandSisa = 0;

  semuaRekap.forEach(function(r, i) {
    const pekerja = semuaPekerja.find(function(p) { return p.ID_Pekerja === r.ID_Pekerja; });
    const grandTotalRow = Number(r.Grand_Total) || 0;
    const kasbonRow = Number(r.Kasbon) || 0;
    const sisaRow = grandTotalRow - kasbonRow;

    sheet.getRange(baris, 1, 1, headerTabel.length).setValues([[
      i + 1, r.Nama_Pekerja, pekerja ? (pekerja.Posisi_Standar || '-') : '-', r.Nama_Lokasi,
      r.Total_Hari_Kerja, grandTotalRow, kasbonRow, sisaRow
    ]]);

    grandTotal += grandTotalRow; grandKasbon += kasbonRow; grandSisa += sisaRow;
    baris++;
  });

  sheet.getRange(baris, 5).setValue('TOTAL').setFontWeight('bold');
  sheet.getRange(baris, 6).setValue(grandTotal).setFontWeight('bold');
  sheet.getRange(baris, 7).setValue(grandKasbon).setFontWeight('bold');
  sheet.getRange(baris, 8).setValue(grandSisa).setFontWeight('bold');
  sheet.autoResizeColumns(1, headerTabel.length);

  const url = exportSheetKePdf_(sheet);
  ss.deleteSheet(sheet);

  return { sukses: true, url: url };
}