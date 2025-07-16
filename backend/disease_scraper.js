// Disease Scraping Service for Kerala
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Kerala districts with their approximate coordinates
const KERALA_DISTRICTS = {
    'Thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
    'Kollam': { lat: 8.8932, lng: 76.6141 },
    'Pathanamthitta': { lat: 9.2648, lng: 76.7870 },
    'Alappuzha': { lat: 9.4981, lng: 76.3388 },
    'Kottayam': { lat: 9.5916, lng: 76.5222 },
    'Idukki': { lat: 9.8233, lng: 76.9635 },
    'Ernakulam': { lat: 10.0168, lng: 76.3078 },
    'Thrissur': { lat: 10.5276, lng: 76.2144 },
    'Palakkad': { lat: 10.7867, lng: 76.6548 },
    'Malappuram': { lat: 11.0500, lng: 76.0700 },
    'Kozhikode': { lat: 11.2588, lng: 75.7804 },
    'Wayanad': { lat: 11.6854, lng: 76.1320 },
    'Kannur': { lat: 11.8745, lng: 75.3704 },
    'Kasaragod': { lat: 12.5000, lng: 75.0000 }
};

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Scrape disease data from reliable sources
async function scrapeDiseaseData() {
    const diseases = [];
    try {
        const whoData = await scrapeWHOData();
        diseases.push(...whoData);
        const newsData = await scrapeNewsData();
        diseases.push(...newsData);
        const googleData = await scrapeGoogleSearchData();
        diseases.push(...googleData);
        console.log(`Scraped ${diseases.length} disease records`);
        return diseases;
    } catch (error) {
        console.error('Error scraping disease data:', error);
        return [];
    }
}

const WHO_OUTBREAKS_URL = 'https://www.who.int/emergencies/disease-outbreak-news';

async function scrapeWHOData() {
    try {
        const response = await axios.get(WHO_OUTBREAKS_URL);
        const $ = cheerio.load(response.data);
        const outbreaks = [];
        // The WHO page structure may change; this is a best-effort selector for the main outbreak list
        $('.list-view--item').each((i, el) => {
            const title = $(el).find('.heading.text-underline').text().trim();
            const link = 'https://www.who.int' + $(el).find('a').attr('href');
            const date = $(el).find('.timestamp').text().trim();
            // Try to extract location/disease from title
            let disease_name = title.split(' - ')[0] || title;
            let location = 'Kerala'; // Default to Kerala, will refine with more sources
            let district = 'General';
            let severity = 'medium';
            let cases = 0;
            let source = 'WHO';
            let last_updated = new Date(date).toISOString();
            if (isNaN(Date.parse(date))) last_updated = new Date().toISOString();
            let coordinates = null;
            outbreaks.push({
                disease_name,
                location,
                district,
                severity,
                cases,
                source,
                last_updated,
                coordinates,
                news_title: title,
                news_url: link
            });
        });
        return outbreaks;
    } catch (error) {
        console.error('Error scraping WHO Disease Outbreak News:', error);
        return [];
    }
}

const GOOGLE_SEARCH_URL = 'https://www.google.com/search?q=kerala+disease+outbreak+news';

async function scrapeGoogleSearchData() {
    try {
        const response = await axios.get(GOOGLE_SEARCH_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
            }
        });
        const $ = cheerio.load(response.data);
        const outbreaks = [];
        $('a').each((i, el) => {
            const link = $(el).attr('href');
            const title = $(el).text().trim();
            if (link && title && link.startsWith('/url?q=')) {
                const url = link.replace('/url?q=', '').split('&')[0];
                // Only include links to news articles
                if (url.includes('news') || url.includes('indiatimes') || url.includes('ndtv') || url.includes('thehindu')) {
                    outbreaks.push({
                        disease_name: 'Unknown',
                        location: 'Kerala',
                        district: 'General',
                        severity: 'medium',
                        cases: 0,
                        source: 'Google News',
                        last_updated: new Date().toISOString(),
                        coordinates: null,
                        news_title: title,
                        news_url: url
                    });
                }
            }
        });
        return outbreaks;
    } catch (error) {
        console.error('Error scraping Google Search:', error);
        return [];
    }
}

// Scrape news data for health alerts
async function scrapeNewsData() {
    try {
        // Using NewsAPI (you'll need to get an API key from newsapi.org)
        const NEWS_API_KEY = process.env.NEWS_API_KEY;
        if (!NEWS_API_KEY) {
            console.log('News API key not found, using mock data');
            return [];
        }
        
        const response = await axios.get(`https://newsapi.org/v2/everything?q=health+disease+Kerala&language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`);
        
        const newsData = response.data.articles
            .filter(article => article.title.toLowerCase().includes('disease') || article.title.toLowerCase().includes('outbreak'))
            .slice(0, 5)
            .map(article => ({
                disease_name: 'Health Alert',
                location: 'Kerala',
                district: 'General',
                severity: 'medium',
                cases: 0,
                source: 'News',
                last_updated: new Date().toISOString(),
                coordinates: { lat: 10.8505, lng: 76.2711 }, // Kerala center
                news_title: article.title,
                news_url: article.url
            }));
            
        return newsData;
    } catch (error) {
        console.error('Error fetching news data:', error);
        return [];
    }
}

// Store disease data in Supabase
async function storeDiseaseData(diseases) {
    try {
        // Clear old data (keep only last 24 hours)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        await supabase
            .from('disease_outbreaks')
            .delete()
            .lt('last_updated', yesterday.toISOString());
        
        // Insert new data
        const { data, error } = await supabase
            .from('disease_outbreaks')
            .insert(diseases)
            .select();
            
        if (error) {
            console.error('Error storing disease data:', error);
            return false;
        }
        
        console.log(`Stored ${data.length} disease records in Supabase`);
        return true;
    } catch (error) {
        console.error('Error in storeDiseaseData:', error);
        return false;
    }
}

// Check if user location matches any disease outbreak
async function checkLocationAlerts(userLat, userLng, radiusKm = 50) {
    try {
        const { data: outbreaks, error } = await supabase
            .from('disease_outbreaks')
            .select('*')
            .gte('last_updated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours
            
        if (error) {
            console.error('Error fetching outbreaks:', error);
            return [];
        }
        
        const nearbyOutbreaks = outbreaks.filter(outbreak => {
            if (!outbreak.coordinates) return false;
            
            const distance = calculateDistance(
                userLat, userLng,
                outbreak.coordinates.lat,
                outbreak.coordinates.lng
            );
            
            return distance <= radiusKm;
        });
        
        return nearbyOutbreaks;
    } catch (error) {
        console.error('Error checking location alerts:', error);
        return [];
    }
}

// Main scraping function to be called every 5 hours
async function runDiseaseScraping() {
    console.log('Starting disease data scraping...');
    
    try {
        // Scrape disease data
        const diseases = await scrapeDiseaseData();
        
        if (diseases.length > 0) {
            // Store in Supabase
            const success = await storeDiseaseData(diseases);
            
            if (success) {
                console.log('Disease data scraping completed successfully');
                
                // Check for users in affected areas and send alerts
                await checkAndSendAlerts();
            } else {
                console.error('Failed to store disease data');
            }
        } else {
            console.log('No disease data found to store');
        }
    } catch (error) {
        console.error('Error in disease scraping:', error);
    }
}

// Check for users in affected areas and send alerts
async function checkAndSendAlerts() {
    try {
        // Get all users with location data
        const { data: users, error } = await supabase
            .from('health_records')
            .select('user_id, location_data')
            .not('location_data', 'is', null);
            
        if (error) {
            console.error('Error fetching users:', error);
            return;
        }
        
        for (const user of users) {
            if (user.location_data && user.location_data.latitude && user.location_data.longitude) {
                const nearbyOutbreaks = await checkLocationAlerts(
                    user.location_data.latitude,
                    user.location_data.longitude
                );
                
                if (nearbyOutbreaks.length > 0) {
                    // Store alert in database
                    await supabase
                        .from('user_alerts')
                        .insert({
                            user_id: user.user_id,
                            alert_type: 'disease_outbreak',
                            message: `Health Alert: ${nearbyOutbreaks.length} disease outbreak(s) detected in your area`,
                            outbreak_data: nearbyOutbreaks,
                            created_at: new Date().toISOString()
                        });
                    
                    console.log(`Alert sent to user ${user.user_id} for ${nearbyOutbreaks.length} outbreaks`);
                }
            }
        }
    } catch (error) {
        console.error('Error checking and sending alerts:', error);
    }
}

// Export functions for use in other modules
module.exports = {
    runDiseaseScraping,
    checkLocationAlerts,
    scrapeDiseaseData,
    storeDiseaseData
};

// Run scraping if this file is executed directly
if (require.main === module) {
    runDiseaseScraping();
} 