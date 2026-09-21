/* India IPO Tracker - website configuration
 * (archived from devrajai/ipo-tracker-india on 2026-09-21)
 *
 * FEED_URL: the URL of the Apps Script web app that serves live data from the
 * Google Sheet. Leave it empty to run in snapshot mode (the site then reads
 * the CSV files in ./data/ committed to this repository).
 *
 * To connect the live feed:
 *   1. In the "IPO Tracker - India" spreadsheet: Extensions > Apps Script
 *      and make sure IPO_Tracker_API.gs is present.
 *   2. Deploy > New deployment > type: Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   3. Copy the Web app URL (ends in /exec) and paste it between the quotes
 *      below, then commit this file.
 */
window.IPO_CONFIG = {
  FEED_URL: ""
};
