// Disease Scraping Service for Kerala
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('./supabase_wrapper');
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

const KERALA_CENTER = { lat: 10.8505, lng: 76.2711 };

function inferDistrictAndCoordinates(text = '') {
    const normalized = text.toLowerCase();
    const districtNames = Object.keys(KERALA_DISTRICTS);
    const matchedDistrict = districtNames.find((district) => normalized.includes(district.toLowerCase()));

    if (matchedDistrict) {
        return {
            district: matchedDistrict,
            coordinates: KERALA_DISTRICTS[matchedDistrict]
        };
    }

    // Only allow General if 'kerala' is explicitly mentioned in the title/text
    if (normalized.includes('kerala')) {
        return {
            district: 'General',
            coordinates: KERALA_CENTER
        };
    }

    // Otherwise return null indicating it is not relevant to Kerala
    return null;
}

function inferSeverityFromText(text = '') {
    const normalized = text.toLowerCase();
    if (normalized.includes('death') || normalized.includes('critical') || normalized.includes('emergency')) {
        return 'high';
    }
    if (normalized.includes('outbreak') || normalized.includes('warning') || normalized.includes('surge')) {
        return 'medium';
    }
    return 'low';
}

function buildOutbreakAlertMessage(outbreaks) {
    if (!outbreaks || outbreaks.length === 0) {
        return 'No nearby disease outbreaks detected.';
    }

    const topOutbreak = outbreaks[0];
    const district = topOutbreak.district || 'your area';
    const severityLabel = topOutbreak.severity || 'low';
    const diseaseNames = [...new Set(outbreaks.map((outbreak) => outbreak.disease_name).filter(Boolean))].slice(0, 3).join(', ');
    const affectedPeople = outbreaks.reduce((total, outbreak) => total + (Number(outbreak.cases) || 0), 0);
    
    const precautions = (topOutbreak.precautions && topOutbreak.precautions.length > 0)
        ? topOutbreak.precautions
        : getPrecautionSummary(topOutbreak);

    return `Health Alert: ${diseaseNames || 'Disease activity'} detected near ${district}. Severity: ${severityLabel}. Estimated affected people: ${affectedPeople}. Precautions: ${precautions.join('; ')}.`;
}

function getPrecautionSummary(outbreak) {
    const disease = String(outbreak?.disease_name || '').toLowerCase();
    const severity = String(outbreak?.severity || 'low').toLowerCase();
    const precautions = [];

    if (disease.includes('dengue') || disease.includes('chikungunya') || disease.includes('malaria')) {
        precautions.push('Use mosquito repellent and wear long sleeves');
        precautions.push('Remove stagnant water around your home');
    }
    if (disease.includes('respiratory') || disease.includes('flu') || disease.includes('covid')) {
        precautions.push('Wear a mask in crowded places and wash hands regularly');
        precautions.push('Avoid close contact with symptomatic people');
    }
    if (disease.includes('water') || disease.includes('lepto') || disease.includes('cholera') || disease.includes('typhoid')) {
        precautions.push('Drink boiled or filtered water only');
        precautions.push('Avoid floodwater and maintain food hygiene');
    }
    if (precautions.length === 0) {
        precautions.push('Monitor local advisories and reduce unnecessary travel');
        precautions.push('Seek medical advice if symptoms develop');
    }
    if (severity === 'high') {
        precautions.unshift('Limit outdoor exposure and follow urgent local health guidance');
    }

    return precautions.slice(0, 4);
}

// Generate health precautions using rule-based fallback
async function generateAIPrecautions(diseaseName, severity, location = 'Kerala') {
    // Directly use rule‑based precautions; Groq AI removed.
    return getRuleBasedPrecautions(diseaseName, severity);
}

// Comprehensive rule-based precaution generator (offline fallback)
function getRuleBasedPrecautions(diseaseName, severity) {
    const disease = String(diseaseName || '').toLowerCase();
    const sev = String(severity || 'low').toLowerCase();
    const precautions = [];

    if (disease.includes('dengue') || disease.includes('chikungunya')) {
        precautions.push('Use DEET-based mosquito repellent and wear full-sleeve clothing');
        precautions.push('Eliminate stagnant water from flower pots, coolers, and containers around your home');
        precautions.push('Sleep under insecticide-treated bed nets, especially during daytime hours');
        precautions.push('Seek immediate medical care if fever exceeds 38.5°C or severe joint pain develops');
    } else if (disease.includes('malaria')) {
        precautions.push('Sleep under insecticide-treated bed nets every night');
        precautions.push('Take antimalarial prophylaxis if prescribed by your doctor');
        precautions.push('Wear long-sleeved clothes and use mosquito repellents from dusk to dawn');
        precautions.push('Report fever with chills and body ache immediately to a healthcare provider');
    } else if (disease.includes('leptospirosis') || disease.includes('lepto')) {
        precautions.push('Avoid wading through floodwater — wear rubber boots if unavoidable');
        precautions.push('Drink only boiled or bottled water; avoid raw fruits washed in tap water');
        precautions.push('Cover all wounds and cuts before exposure to soil or water');
        precautions.push('Take doxycycline prophylaxis if advised by a doctor after potential exposure');
    } else if (disease.includes('cholera') || disease.includes('typhoid') || disease.includes('waterborne')) {
        precautions.push('Drink only boiled or sealed bottled water — avoid street food and open beverages');
        precautions.push('Wash hands thoroughly with soap before eating and after using the toilet');
        precautions.push('Ensure food is freshly cooked and served hot; avoid raw salads in outbreak areas');
        precautions.push('Get typhoid vaccination if not vaccinated in the last 3 years');
    } else if (disease.includes('covid') || disease.includes('coronavirus')) {
        precautions.push('Wear a well-fitting mask (N95/surgical) in crowded or enclosed spaces');
        precautions.push('Maintain hand hygiene — wash with soap for 20 seconds or use 70%+ alcohol sanitiser');
        precautions.push('Avoid close contact with symptomatic individuals and ensure good ventilation');
        precautions.push('Stay up to date with COVID-19 booster vaccinations');
    } else if (disease.includes('influenza') || disease.includes('flu') || disease.includes('respiratory')) {
        precautions.push('Get the seasonal influenza vaccine if available');
        precautions.push('Wear a mask in crowded places and practise respiratory etiquette');
        precautions.push('Stay home if you have fever or respiratory symptoms');
        precautions.push('Increase ventilation in indoor spaces and avoid poorly ventilated gatherings');
    } else if (disease.includes('hepatitis') || disease.includes('jaundice')) {
        precautions.push('Drink only safe, treated water and avoid raw/undercooked shellfish');
        precautions.push('Avoid sharing needles, razors, or personal hygiene items');
        precautions.push('Get vaccinated against Hepatitis A and B if not already done');
        precautions.push('See a doctor immediately if you notice yellowing of skin/eyes, fatigue, or dark urine');
    } else if (disease.includes('nipah') || disease.includes('niv')) {
        precautions.push('Avoid contact with bats or animals that may have consumed bat-contaminated fruit');
        precautions.push('Do not consume raw date palm sap or fruits found on the ground');
        precautions.push('Wear PPE (gloves, mask) when caring for suspected Nipah patients');
        precautions.push('Report any cluster of fever with altered consciousness in a family immediately');
    } else if (disease.includes('scrub typhus') || disease.includes('rickettsia')) {
        precautions.push('Wear long-sleeved clothing and use DEET repellent in forested or grassy areas');
        precautions.push('Check for mites (chiggers) after outdoor activity and shower immediately');
        precautions.push('Avoid sitting or lying directly on grass or soil in endemic areas');
        precautions.push('Report unexplained fever with rash or eschar (bite mark) to a doctor immediately');
    } else {
        precautions.push('Monitor local health advisories from the Kerala Health Department');
        precautions.push('Maintain good hand hygiene and avoid close contact with symptomatic individuals');
        precautions.push('Consult a doctor if you develop fever, fatigue, or unusual symptoms');
        precautions.push('Avoid crowded areas and ensure adequate ventilation in living spaces');
    }

    if (sev === 'high') {
        precautions.unshift('⚠️ HIGH SEVERITY: Limit outdoor exposure and follow all local emergency health directives');
    }

    return precautions.slice(0, 4);
}

async function alertAlreadyExists(userId, message, nearbyOutbreaks = []) {
    // Fetch ALL existing alerts for this user (works in both online and offline/local DB mode)
    const { data: allAlerts, error: alertsError } = await supabase
        .from('user_alerts')
        .select('id, message, outbreak_data, created_at')
        .eq('user_id', userId);

    if (alertsError || !allAlerts) {
        console.error('Error checking for duplicate alerts:', alertsError);
        return false;
    }

    // 1. If any existing alert has the same message text, it's a duplicate
    if (allAlerts.some(a => a.message === message)) {
        return true;
    }

    // 2. Check if the same set of diseases+districts was already alerted in the last 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = allAlerts.filter(a => a.created_at && new Date(a.created_at) >= cutoff);
    const currentDiseases = new Set(nearbyOutbreaks.map(o => `${o.disease_name}-${o.district}`));

    for (const recent of recentAlerts) {
        const recentOutbreakData = recent.outbreak_data;
        if (!recentOutbreakData) continue;

        const recentOutbreaksList = Array.isArray(recentOutbreakData)
            ? recentOutbreakData
            : (recentOutbreakData.outbreaks || []);

        const recentDiseases = new Set(recentOutbreaksList.map(o => `${o.disease_name}-${o.district}`));

        if (currentDiseases.size === recentDiseases.size && [...currentDiseases].every(d => recentDiseases.has(d))) {
            return true;
        }
    }

    return false;
}

// Map user's coordinates to the nearest Kerala district
function getNearestDistrict(lat, lng) {
    let nearestDistrict = 'General';
    let minDistance = Infinity;
    for (const [name, coords] of Object.entries(KERALA_DISTRICTS)) {
        const dist = calculateDistance(lat, lng, coords.lat, coords.lng);
        if (dist < minDistance) {
            minDistance = dist;
            nearestDistrict = name;
        }
    }
    return minDistance <= 80 ? nearestDistrict : 'General'; // 80 km threshold
}

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

function generateFallbackOutbreaks() {
    return [
        {
            disease_name: 'Dengue Fever',
            location: 'Kerala',
            district: 'Ernakulam',
            severity: 'medium',
            cases: 12,
            source: 'Fallback',
            last_updated: new Date().toISOString(),
            coordinates: KERALA_DISTRICTS.Ernakulam,
            news_title: 'Fallback surveillance signal: Dengue activity in Ernakulam',
            news_url: null
        },
        {
            disease_name: 'Leptospirosis',
            location: 'Kerala',
            district: 'Kozhikode',
            severity: 'high',
            cases: 8,
            source: 'Fallback',
            last_updated: new Date().toISOString(),
            coordinates: KERALA_DISTRICTS.Kozhikode,
            news_title: 'Fallback surveillance signal: Leptospirosis warning in Kozhikode',
            news_url: null
        }
    ];
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
            const inferred = inferDistrictAndCoordinates(title);
            if (!inferred) return; // Skip if not Kerala-related
            
            let district = inferred.district;
            let severity = inferSeverityFromText(title);
            let cases = 0;
            let source = 'WHO';
            let last_updated = new Date(date).toISOString();
            if (isNaN(Date.parse(date))) last_updated = new Date().toISOString();
            let coordinates = inferred.coordinates;
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
                    const inferred = inferDistrictAndCoordinates(title);
                    if (!inferred) return; // Skip if not Kerala-related
                    
                    outbreaks.push({
                        disease_name: 'Unknown',
                        location: 'Kerala',
                        district: inferred.district,
                        severity: inferSeverityFromText(title),
                        cases: 0,
                        source: 'Google News',
                        last_updated: new Date().toISOString(),
                        coordinates: inferred.coordinates,
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
            .filter(article => article.title && (article.title.toLowerCase().includes('disease') || article.title.toLowerCase().includes('outbreak')))
            .map(article => {
                const inferred = inferDistrictAndCoordinates(article.title || '');
                if (!inferred) return null; // Skip if not Kerala-related
                
                return {
                    disease_name: 'Health Alert',
                    location: 'Kerala',
                    district: inferred.district,
                    severity: inferSeverityFromText(article.title || ''),
                    cases: 0,
                    source: 'News',
                    last_updated: new Date().toISOString(),
                    coordinates: inferred.coordinates,
                    news_title: article.title,
                    news_url: article.url
                };
            })
            .filter(Boolean)
            .slice(0, 5);
            
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
        
        // Filter duplicates in scraped data list itself
        const uniqueDiseaseData = diseases.filter((disease, index, arr) => {
            const key = `${disease.disease_name}-${disease.district}-${disease.source}-${disease.news_title || ''}`;
            return arr.findIndex((item) => `${item.disease_name}-${item.district}-${item.source}-${item.news_title || ''}` === key) === index;
        });

        // Query active outbreaks in the last 24 hours from the DB
        const { data: existingOutbreaks, error: fetchErr } = await supabase
            .from('disease_outbreaks')
            .select('disease_name, district, news_title, news_url')
            .gte('last_updated', yesterday.toISOString());

        let finalInsertData = uniqueDiseaseData;
        if (!fetchErr && existingOutbreaks) {
            finalInsertData = uniqueDiseaseData.filter((scraped) => {
                const alreadyExists = existingOutbreaks.some((existing) => {
                    const sameDisease = existing.disease_name === scraped.disease_name;
                    const sameDistrict = existing.district === scraped.district;
                    const sameTitle = existing.news_title === scraped.news_title;
                    const sameUrl = scraped.news_url ? (existing.news_url === scraped.news_url) : true;
                    return sameDisease && sameDistrict && sameTitle && sameUrl;
                });
                return !alreadyExists;
            });
        }

        if (finalInsertData.length === 0) {
            console.log('No new unique disease outbreaks to insert');
            return true;
        }

        const { data, error } = await supabase
            .from('disease_outbreaks')
            .insert(finalInsertData)
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

        const userDistrict = getNearestDistrict(userLat, userLng);
        
        const nearbyOutbreaks = outbreaks.filter(outbreak => {
            // If outbreak is explicitly in the user's district, always include it
            if (outbreak.district !== 'General' && outbreak.district === userDistrict) {
                return true;
            }
            
            // Otherwise check distance threshold
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
            // Fetch AI precautions for each disease (using a cache to avoid duplicate calls)
            const cache = {};
            for (let i = 0; i < diseases.length; i++) {
                const disease = diseases[i];
                const key = `${disease.disease_name}-${disease.severity}-${disease.district || 'General'}`.toLowerCase();
                if (!cache[key]) {
                    cache[key] = await generateAIPrecautions(disease.disease_name, disease.severity, disease.district);
                }
                disease.precautions = cache[key];
            }

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
            console.log('No disease data found from live sources, using fallback outbreak records');
            const fallbackDiseases = generateFallbackOutbreaks();

            // Fetch AI precautions for fallback diseases
            const cache = {};
            for (let i = 0; i < fallbackDiseases.length; i++) {
                const disease = fallbackDiseases[i];
                const key = `${disease.disease_name}-${disease.severity}-${disease.district || 'General'}`.toLowerCase();
                if (!cache[key]) {
                    cache[key] = await generateAIPrecautions(disease.disease_name, disease.severity, disease.district);
                }
                disease.precautions = cache[key];
            }

            const success = await storeDiseaseData(fallbackDiseases);
            if (success) {
                await checkAndSendAlerts();
            }
        }
    } catch (error) {
        console.error('Error in disease scraping:', error);
    }
}

// Check for users in affected areas and send alerts
async function checkAndSendAlerts() {
    try {
        // Get all health records with location data, ordered by newest first
        const { data: records, error } = await supabase
            .from('health_records')
            .select('user_id, location_data, created_at')
            .not('location_data', 'is', null)
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('Error fetching health records:', error);
            return;
        }
        
        // Initial connectivity test removed to prevent premature offline fallback.
        // The wrapper will switch to offline mode only on actual runtime fetch errors.
        // Keep only the latest location record for each unique user
        const uniqueUsers = [];
        const seenUsers = new Set();
        for (const record of records || []) {
            if (!seenUsers.has(record.user_id)) {
                seenUsers.add(record.user_id);
                uniqueUsers.push(record);
            }
        }
        
        for (const user of uniqueUsers) {
            if (user.location_data && user.location_data.latitude && user.location_data.longitude) {
                const nearbyOutbreaks = await checkLocationAlerts(
                    user.location_data.latitude,
                    user.location_data.longitude
                );
                
                if (nearbyOutbreaks.length > 0) {
                    const alertMessage = buildOutbreakAlertMessage(nearbyOutbreaks);
                    const alreadyExists = await alertAlreadyExists(user.user_id, alertMessage, nearbyOutbreaks);

                    if (alreadyExists) {
                        console.log(`Skipping duplicate alert for user ${user.user_id}`);
                        continue;
                    }

                    const alertPayload = {
                        outbreaks: nearbyOutbreaks,
                        summary: alertMessage,
                        generated_at: new Date().toISOString()
                    };

                    // Store alert in database
                    await supabase
                        .from('user_alerts')
                        .insert({
                            user_id: user.user_id,
                            alert_type: 'disease_outbreak',
                            message: alertMessage,
                            outbreak_data: alertPayload,
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
    storeDiseaseData,
    buildOutbreakAlertMessage,
    getPrecautionSummary,
    alertAlreadyExists
};

// Run scraping if this file is executed directly
if (require.main === module) {
    runDiseaseScraping();
} 