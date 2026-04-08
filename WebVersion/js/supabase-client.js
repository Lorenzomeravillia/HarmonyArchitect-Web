(function() {
    // Uses the Legacy Anon API Key provided to maximize compatibility.
    const SUPABASE_URL = 'https://rcgnwbayinwjmejjofez.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZ253YmF5aW53am1lampvZmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjM0NjEsImV4cCI6MjA5MDg5OTQ2MX0.2Nv2haVtMuz_SiX-bLJjUTVeg83bXSv-rJuUSYWOKZQ';
    
    // Fallback gracefully if library is missing
    if (!window.supabase) {
        console.warn("Supabase SDK non caricato. Modalità offline forzata.");
        window.dbClient = { getUserId: () => null, isReady: false };
        return;
    }

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const QUEUE_KEY = 'cv_offline_queue';

    class DBClient {
        constructor() {
            this.user = null;
            this.isSyncing = false;
            this.isReady = false;
        }

        async init() {
            try {
                // Restore an existing session without re-registering an anonymous user constantly
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (session && session.user) {
                    this.user = session.user;
                } else {
                    // Create new anonymous user
                    const { data, error: signInError } = await supabase.auth.signInAnonymously();
                    if (signInError) throw signInError;
                    
                    this.user = data.user;
                    
                    // Create corresponding user profile in backend table bypassing generating uuid
                    await supabase.schema('cv').from('users').upsert({
                        id: this.user.id,
                        auth_provider: 'anonymous'
                    }, { onConflict: 'id' });
                }
                this.isReady = true;
                
                // Fire and forget offline sync 
                setTimeout(() => this.processOfflineQueue(), 1200);
            } catch (err) {
                console.warn("Supabase initialization failed (likely offline):", err);
            }
        }

        getUserId() {
            return this.user ? this.user.id : null;
        }

        addToQueue(table, action, data) {
            let q = [];
            try { q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch(e){}
            q.push({ table, action, data, timestamp: new Date().toISOString() });
            localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
        }

        async processOfflineQueue() {
            if (this.isSyncing) return;
            let q = [];
            try { q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch(e){}
            if (q.length === 0) return;

            this.isSyncing = true;
            const newQ = [];
            
            // Re-eval in chronological order
            for (let item of q) {
                try {
                    let req;
                    if (item.action === 'insert') {
                        req = supabase.schema('cv').from(item.table).insert(item.data);
                    } else if (item.action === 'upsert') {
                        // Per i weak_spots, dobbiamo assicurare la coerenza sul constraint se necessario
                        req = supabase.schema('cv').from(item.table).upsert(item.data);
                    } else if (item.action === 'update') {
                        req = supabase.schema('cv').from(item.table).update(item.data.payload).eq(item.data.key, item.data.val);
                    }

                    if (req) {
                        const { error } = await req;
                        if (error) throw error;
                    }
                } catch (e) {
                    console.error("Failed syncing an offline record:", e);
                    newQ.push(item); // Keep in queue for next restart
                }
            }
            
            localStorage.setItem(QUEUE_KEY, JSON.stringify(newQ));
            this.isSyncing = false;
        }

        async safeWrite(table, action, data) {
            if (!this.user || !this.isReady) {
                this.addToQueue(table, action, data);
                return null;
            }

            try {
                let req;
                if (action === 'insert') {
                    req = supabase.schema('cv').from(table).insert(data).select();
                } else if (action === 'upsert') {
                    // Elicit standard upsert
                    req = supabase.schema('cv').from(table).upsert(data).select();
                } else if (action === 'update') {
                    req = supabase.schema('cv').from(table).update(data.payload).eq(data.key, data.val).select();
                }
                
                const { data: resData, error } = await req;
                if (error) {
                    console.warn(`SafeWrite error for ${table}:`, error);
                    this.addToQueue(table, action, data);
                    return null;
                }
                return resData ? resData[0] : true;
            } catch (e) {
               console.warn(`SafeWrite caught exception for ${table}:`, e);
               this.addToQueue(table, action, data);
               return null;
            }
        }

        async getUserStats() {
             if (!this.user || !this.isReady) return null;
             try {
                const { data, error } = await supabase.schema('cv').from('user_stats').select('*').eq('user_id', this.user.id).single();
                if (error) return null;
                return data;
             } catch(err) { return null; }
        }

        get client() {
            return supabase;
        }
    }

    // Expose the singleton to the window
    window.dbClient = new DBClient();
})();
