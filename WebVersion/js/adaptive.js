(function() {
    const ADAPTIVE_ENABLED_KEY = 'cv_adaptive_enabled';

    class AdaptiveEngine {
        
        get isEnabled() {
            return localStorage.getItem(ADAPTIVE_ENABLED_KEY) === 'true';
        }

        set isEnabled(val) {
            localStorage.setItem(ADAPTIVE_ENABLED_KEY, val ? 'true' : 'false');
        }

        // ============================================
        // Spaced Repetition (SM-2 Simplified) Tracking
        // ============================================

        parseQuality(answerStr) {
            // "Cmaj7" -> "maj7", "D#m7b5" -> "m7b5"
            if (!answerStr) return "unknown";
            const match = answerStr.match(/^[A-G][#b]?(.*)$/);
            return match ? (match[1] || "M") : "unknown";
        }

        async updateWeakSpots(userId, challenge, isCorrect) {
            if (!window.dbClient || !window.dbClient.isReady) return;

            const dimensions = [
                { dimension: 'quality', value: challenge.chord_quality },
                { dimension: 'root', value: challenge.chord_root },
            ];

            if (!isCorrect && challenge.answer_given) {
                const ansQuality = this.parseQuality(challenge.answer_given);
                const confusion = `${challenge.chord_quality}_vs_${ansQuality}`;
                dimensions.push({ dimension: 'interval_confusion', value: confusion });
            }

            if (challenge.roman_numeral) {
                dimensions.push({ 
                    dimension: 'progression', 
                    value: challenge.roman_numeral 
                });
            }

            for (const dim of dimensions) {
                await this.upsertWeakSpot(userId, dim, isCorrect);
            }
        }

        async upsertWeakSpot(userId, dim, isCorrect) {
            try {
                const supabase = window.dbClient.client;
                if (!supabase) return;

                // Grab existing directly from DB to calculate SM-2 factors
                let { data: existing, error } = await supabase.schema('cv')
                    .from('weak_spots')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('dimension', dim.dimension)
                    .eq('value', dim.value)
                    .single();

                if (existing) {
                    const newAttempts = existing.total_attempts + 1;
                    const newCorrect = existing.correct_count + (isCorrect ? 1 : 0);
                    const newErrorRate = 1 - (newCorrect / newAttempts);
                    
                    let newInterval, newEase;
                    if (isCorrect) {
                        newEase = Math.min(existing.ease_factor + 0.1, 3.0);
                        newInterval = existing.interval_days * newEase;
                    } else {
                        newEase = Math.max(existing.ease_factor - 0.2, 1.3);
                        newInterval = 1; // reset a domani
                    }
                    
                    const nextReview = new Date();
                    nextReview.setDate(nextReview.getDate() + newInterval);
                    
                    await window.dbClient.safeWrite('weak_spots', 'upsert', {
                        id: existing.id,
                        user_id: userId,
                        dimension: dim.dimension,
                        value: dim.value,
                        total_attempts: newAttempts,
                        correct_count: newCorrect,
                        error_rate: newErrorRate,
                        ease_factor: newEase,
                        interval_days: newInterval,
                        next_review_at: nextReview.toISOString(),
                        last_seen_at: new Date().toISOString()
                    });
                } else {
                    const nextReview = new Date();
                    nextReview.setDate(nextReview.getDate() + 1);
                    
                    await window.dbClient.safeWrite('weak_spots', 'insert', {
                        user_id: userId,
                        dimension: dim.dimension,
                        value: dim.value,
                        total_attempts: 1,
                        correct_count: isCorrect ? 1 : 0,
                        error_rate: isCorrect ? 0 : 1,
                        next_review_at: nextReview.toISOString(),
                        last_seen_at: new Date().toISOString()
                    });
                }
            } catch (err) {
                console.warn("Failed syncing weak_spot live (will fall back offline mode context later)", err);
                // Can't effectively safely offline queue SM-2 calculation without holding states, so we swallow error gently.
            }
        }

        // ============================================
        // Selection Algorithms
        // ============================================

        async selectNextChallengeOverrides(userId, level, mode) {
            // Returns configuration hints for MusicEngine if adaptive mode mandates it
            if (!this.isEnabled) return null; // Fallback to random
            if (!window.dbClient || !window.dbClient.isReady) return null;

            try {
                const supabase = window.dbClient.client;
                if(!supabase) return null;

                const { data: dueWeakSpots, error } = await supabase.schema('cv')
                    .from('weak_spots')
                    .select('*')
                    .eq('user_id', userId)
                    .lte('next_review_at', new Date().toISOString())
                    .order('error_rate', { ascending: false })
                    .limit(10);
                
                if (error) return null;

                const roll = Math.random();
                if (roll < 0.6 && dueWeakSpots && dueWeakSpots.length > 0) {
                    // ADAPTIVE (60%): Force configuration towards the weakest link
                    const spot = dueWeakSpots[0];
                    console.log("AdaptiveEngine Triggered: WEAK SPOT ->", spot);
                    // Generate hints object
                    if (spot.dimension === 'quality') return { forceQuality: spot.value };
                    if (spot.dimension === 'root') return { forceRoot: spot.value };
                    if (spot.dimension === 'progression') return { forceProgression: spot.value };
                } 
                else if (roll < 0.9) {
                    // LEVEL (30%): Random exploration of current level. returning null tells musicEngine to use random logic.
                    console.log("AdaptiveEngine Triggered: RANDOM EXPLORATION");
                    return null; 
                } 
                else {
                    // CONSOLIDATION (10%): Test strong assets
                    console.log("AdaptiveEngine Triggered: CONSOLIDATION");
                    const { data: strongSpots } = await supabase.schema('cv')
                        .from('weak_spots')
                        .select('*')
                        .eq('user_id', userId)
                        .gt('correct_count', 4)  // Highly correct
                        .order('error_rate', { ascending: true }) // Smallest errors
                        .limit(5);

                    if (strongSpots && strongSpots.length > 0) {
                        const spot = strongSpots[Math.floor(Math.random() * strongSpots.length)];
                        if (spot.dimension === 'quality') return { forceQuality: spot.value };
                        if (spot.dimension === 'root') return { forceRoot: spot.value };
                        if (spot.dimension === 'progression') return { forceProgression: spot.value };
                    }
                    return null;
                }
            } catch (err) {
                return null;
            }
        }
    }

    window.adaptiveEngine = new AdaptiveEngine();
})();
