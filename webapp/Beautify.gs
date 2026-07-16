/**
 * One-off beautifier for the patient register.
 * Single font (Lato), comfortable sizing, tidy column widths, refined green
 * headers, subtle row banding, sensible alignment/wrap, and frozen panes.
 * Safe to re-run. NOT part of the web app — run manually from the editor.
 */
var BEAUTIFY_FONT = 'Lato';
var HEADER_GREEN = '#1E6B3A';
var BODY_INK = '#202124';
var BAND_TINT = '#EAF4EC';

function beautifyRegister() {
  var ss = SpreadsheetApp.getActive();
  var log = [];
  beautifyPatients_(ss, log);
  beautifyVisits_(ss, log);
  beautifyAux_(ss, 'Patient Card', log);
  beautifyAux_(ss, 'How to use', log);
  SpreadsheetApp.flush();
  Logger.log(log.join('\n'));
  return log.join('\n');
}

function styleHeader_(sheet, lastCol) {
  sheet.getRange(1, 1, 1, lastCol)
    .setFontFamily(BEAUTIFY_FONT).setFontSize(13).setFontWeight('bold')
    .setFontColor('#ffffff').setBackground(HEADER_GREEN)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(1, 52);
}

function clearBandings_(sheet) {
  sheet.getBandings().forEach(function (b) { b.remove(); });
}

function bandBody_(sheet, firstRow, lastRow, lastCol) {
  if (lastRow < firstRow) return;
  var band = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, lastCol)
    .applyRowBanding(SpreadsheetApp.BandingTheme.GREEN, false, false);
  band.setHeaderRowColor(null);
  band.setFirstRowColor('#ffffff');
  band.setSecondRowColor(BAND_TINT);
}

function setAlign_(sheet, cols, firstRow, nRows, how) {
  cols.forEach(function (c) {
    sheet.getRange(firstRow, c, nRows, 1).setHorizontalAlignment(how);
  });
}

function setWrapCols_(sheet, cols, firstRow, nRows, wrap) {
  cols.forEach(function (c) {
    var r = sheet.getRange(firstRow, c, nRows, 1);
    if (wrap) r.setWrap(true);
    else r.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  });
}

function beautifyPatients_(ss, log) {
  var sh = ss.getSheetByName('Patients');
  if (!sh) { log.push('Patients: NOT FOUND'); return; }
  var lastRow = sh.getLastRow();
  var lastCol = 22; // A..V
  sh.getRange(1, 1, Math.max(lastRow, 1), lastCol)
    .setFontFamily(BEAUTIFY_FONT).setVerticalAlignment('middle');
  if (lastRow >= 2) {
    sh.getRange(2, 1, lastRow - 1, lastCol).setFontSize(12).setFontColor(BODY_INK);
  }
  styleHeader_(sh, lastCol);

  var widths = [60,86,68,205,120,116,182,142,134,64,96,80,76,84,270,185,124,142,132,142,142,142];
  for (var i = 0; i < widths.length; i++) sh.setColumnWidth(i + 1, widths[i]);

  if (lastRow >= 2) {
    var n = lastRow - 1;
    setAlign_(sh, [1,2,3,9,10,11,12,13,14], 2, n, 'center');       // Ref,Date,Time,Sex,Age,Wt,BP,Pulse,Temp
    setAlign_(sh, [4,5,6,7,8,15,16,17,18,19,20,21,22], 2, n, 'left');
    setWrapCols_(sh, [4,7,8,15,16,17,18,19,20,21,22], 2, n, true); // Name,Address,FamHx,Symptoms,Clin,Allergy,Caus,Loc,Const,Sens,Mod
    setWrapCols_(sh, [1,2,3,5,6,9,10,11,12,13,14], 2, n, false);
    clearBandings_(sh);
    bandBody_(sh, 2, lastRow, lastCol);
    sh.autoResizeRows(2, n);
  }
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
  log.push('Patients: styled ' + lastRow + ' rows');
}

function beautifyVisits_(ss, log) {
  var sh = ss.getSheetByName('Visits');
  if (!sh) { log.push('Visits: NOT FOUND'); return; }
  var lastRow = sh.getLastRow();
  var lastCol = 6; // A..F (any hidden helper left untouched)
  sh.getRange(1, 1, Math.max(lastRow, 1), lastCol)
    .setFontFamily(BEAUTIFY_FONT).setVerticalAlignment('middle');
  if (lastRow >= 2) {
    sh.getRange(2, 1, lastRow - 1, lastCol).setFontSize(12).setFontColor(BODY_INK);
  }
  styleHeader_(sh, lastCol);

  var widths = [72,96,72,205,290,400];
  for (var i = 0; i < widths.length; i++) sh.setColumnWidth(i + 1, widths[i]);

  if (lastRow >= 2) {
    var n = lastRow - 1;
    setAlign_(sh, [1,2,3], 2, n, 'center');
    setAlign_(sh, [4,5,6], 2, n, 'left');
    setWrapCols_(sh, [4,5,6], 2, n, true);
    clearBandings_(sh);
    bandBody_(sh, 2, lastRow, lastCol);
    sh.autoResizeRows(2, n);
  }
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
  log.push('Visits: styled ' + lastRow + ' rows');
}

function beautifyAux_(ss, name, log) {
  var sh = ss.getSheetByName(name);
  if (!sh) { log.push(name + ': not found (skipped)'); return; }
  var lastRow = Math.max(sh.getLastRow(), 1);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  sh.getRange(1, 1, lastRow, lastCol).setFontFamily(BEAUTIFY_FONT);
  log.push(name + ': font set on ' + lastRow + 'x' + lastCol);
}
