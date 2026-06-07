// Scheduler for running disease scraping every 12 hours
const cron = require('node-cron');
const { runDiseaseScraping } = require('./disease_scraper');
require('dotenv').config();

// Schedule disease scraping to run every 12 hours (configurable)
const scheduleDiseaseScraping = () => {
    // Use environment variable or default to every 12 hours
    const cronSchedule = process.env.SCRAPE_CRON_SCHEDULE || '0 */12 * * *';
    cron.schedule(cronSchedule, async () => {
        console.log('Scheduled disease scraping started at:', new Date().toISOString());
        try {
            await runDiseaseScraping();
            console.log('Scheduled disease scraping completed at:', new Date().toISOString());
        } catch (error) {
            console.error('Error in scheduled disease scraping:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // Kerala timezone
    });
    
    console.log(`Disease scraping scheduled to run with cron: ${cronSchedule}`);
};

// Run initial scraping on startup
const runInitialScraping = async () => {
    console.log('Running initial disease scraping...');
    try {
        await runDiseaseScraping();
        console.log('Initial disease scraping completed');
    } catch (error) {
        console.error('Error in initial disease scraping:', error);
    }
};

// Export functions
module.exports = {
    scheduleDiseaseScraping,
    runInitialScraping
};

// Start scheduler if this file is executed directly
if (require.main === module) {
    runInitialScraping();
    scheduleDiseaseScraping();
} 