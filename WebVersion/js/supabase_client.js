// Supabase Configuration
const SUPABASE_URL = 'https://rcgnwbayinwjmejjofez.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZ253YmF5aW53am1lampvZmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjM0NjEsImV4cCI6MjA5MDg5OTQ2MX0.2Nv2haVtMuz_SiX-bLJjUTVeg83bXSv-rJuUSYWOKZQ';

// Initialize Supabase Client safely
let supabase = null;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supaClient = supabase;
} catch (e) {
    console.error("Critical: Failed to initialize Supabase client on load", e);
    alert("Supabase Failed to Init: " + e.message);
}

// Auth State & Profile
window.currentUser = null;
window.currentProfile = null;

async function fetchProfile() {
    if (!window.currentUser) return null;
    const { data, error } = await supabase
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
    const { data, error } = await supabase.rpc('consume_energy');
    if (error) {
        console.error("Error consuming energy", error);
        return false;
    }
    await fetchProfile(); // refresh local profile energy counter
    return data; // boolean true if energy was deducted or if user is PRO
}

async function getEnergy() {
    if (!window.currentUser) {
        return parseInt(localStorage.getItem('anon_energy') || '3');
    }
    if (!window.currentProfile) await fetchProfile();
    if (window.currentProfile.tier === 'pro') return '∞';
    return window.currentProfile.energy_balance;
    
}

// Initial Auth Check
async function initAuth(onStateChange) {
    const { data: { session } } = await supabase.auth.getSession();
    window.currentUser = session ? session.user : null;
    
    if (window.currentUser) {
        await fetchProfile();
    }
    
    supabase.auth.onAuthStateChange(async (event, session) => {
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
window.supaInitAuth = initAuth;
window.supaConsumeEnergy = consumeEnergy;
window.supaGetEnergy = getEnergy;
