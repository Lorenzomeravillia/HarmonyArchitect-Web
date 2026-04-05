// Supabase Configuration
const SUPABASE_URL = 'https://rcgnwbayinwjmejjofez.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZ253YmF5aW53am1lampvZmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjM0NjEsImV4cCI6MjA5MDg5OTQ2MX0.2Nv2haVtMuz_SiX-bLJjUTVeg83bXSv-rJuUSYWOKZQ';

// Global reference
window.dbClient = null;

function ensureClient() {
    if (window.dbClient) return window.dbClient;
    try {
        window.dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("DB Client successfully initialized on demand.");
    } catch (e) {
        console.error("Critical: Failed to initialize Supabase client", e);
        alert("Supabase Failed to Init: " + e.message);
    }
    return window.dbClient;
}

// Auth State & Profile
window.currentUser = null;
window.currentProfile = null;

async function fetchProfile() {
    if (!window.currentUser) return null;
    const client = ensureClient();
    if (!client) return null;
    const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', window.currentUser.id)
        .single();
    
    if (error) {
        console.error("Error fetching profile", error);
        return null;
    }
    window.currentProfile = data;
    return data;
}

// Energy consumption helper
async function consumeEnergy() {
    if (localStorage.getItem('beta_bypass') === 'true') return true;

    // If not logged in, fallback to local tracking
    if (!window.currentUser) {
        let localEnergy = parseInt(localStorage.getItem('anon_energy') || '3');
        if (localEnergy > 0) {
            localStorage.setItem('anon_energy', (localEnergy - 1).toString());
            return true;
        } else {
            return false;
        }
    }

    // If logged in, call secure backend RPC
    const client = ensureClient();
    if (!client) return false;
    const { data, error } = await client.rpc('consume_energy');
    if (error) {
        console.error("Error consuming energy", error);
        return false;
    }
    await fetchProfile(); // refresh local profile energy counter
    return data; // boolean true if energy was deducted or if user is PRO
}

async function getEnergy() {
    if (localStorage.getItem('beta_bypass') === 'true') return '∞';

    if (!window.currentUser) {
        return parseInt(localStorage.getItem('anon_energy') || '3');
    }
    if (!window.currentProfile) await fetchProfile();
    if (window.currentProfile.tier === 'pro') return '∞';
    return window.currentProfile.energy_balance;
    
}

// Initial Auth Check
async function initAuth(onStateChange) {
    const client = ensureClient();
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    window.currentUser = session ? session.user : null;
    
    if (window.currentUser) {
        await fetchProfile();
    }
    
    client.auth.onAuthStateChange(async (event, session) => {
        window.currentUser = session ? session.user : null;
        if (window.currentUser) {
            await fetchProfile();
        } else {
            window.currentProfile = null;
        }
        if (onStateChange) onStateChange(event, session);
    });
}

// Expose to window for main.js 
window.getDbClient = ensureClient;
window.initDbAuth = initAuth;
window.consumeDbEnergy = consumeEnergy;
window.getDbEnergy = getEnergy;
