"""
Consulente teorico per suggerimenti pedagogici musicali.
Genera suggerimenti teorici personalizzati basati sull'analisi degli errori
e sul progresso dell'utente.
"""

from typing import List, Dict, Optional, Any
from datetime import datetime
from core.models.exercise_model import ErrorCategory, DifficultyLevel, ExerciseType
from core.pedagogy.error_classifier import ErrorClassifier

class TheoryAdvisor:
    """Consulente teorico per suggerimenti pedagogici musicali"""
    
    def __init__(self):
        self.error_classifier = ErrorClassifier()
        self.user_progress = {}
        
        # Database di conoscenza teorica
        self.theory_knowledge = {
            # Triadi Base
            "triads": {
                "major": {
                    "description": "Accordo maggiore: fondamentale + terza maggiore + quinta perfetta",
                    "character": "Sonorità aperta, brillante, positiva",
                    "examples": ["Happy Birthday", "molti brani pop"],
                    "practice_tips": ["Canta la terza maggiore (4 semitoni dalla fondamentale)", 
                                      "Ascolta il carattere 'aperto' dell'accordo"]
                },
                "minor": {
                    "description": "Accordo minore: fondamentale + terza minore + quinta perfetta",
                    "character": "Sonorità misteriosa, malinconica, introspettiva",
                    "examples": ["Many jazz ballads", "musica classica romantica"],
                    "practice_tips": ["Canta la terza minore (3 semitoni dalla fondamentale)",
                                      "Ascolta il carattere 'misterioso' dell'accordo"]
                },
                "diminished": {
                    "description": "Accordo diminuito: fondamentale + terza minore + quinta diminuita",
                    "character": "Sonorità aspra, dissonante, misteriosa",
                    "examples": ["Jazz harmony", "musica barocca"],
                    "practice_tips": ["Ascolta la quinta diminuita (6 semitoni dalla fondamentale)",
                                      "L'accordo diminuito spesso funge come dominante"]
                },
                "augmented": {
                    "description": "Accordo aumentato: fondamentale + terza maggiore + quinta aumentata",
                    "character": "Sonorità 'espansa', instabile, misteriosa",
                    "examples": ["Musica impressionista", "jazz moderno"],
                    "practice_tips": ["Ascolta la quinta aumentata (8 semitoni dalla fondamentale)",
                                      "L'accordo aumentato crea senso di 'espansione'"]
                }
            },
            
            # Settime
            "seventh_chords": {
                "maj7": {
                    "description": "Accordo maggiore con settima maggiore",
                    "character": "Sonorità sofisticata, jazzica, 'cool'",
                    "function": "Tonica in jazz harmony",
                    "practice_tips": ["Ascolta la settima maggiore (11 semitoni dalla fondamentale)",
                                      "Cmaj7 vs C7: la settima maggiore crea meno tensione"]
                },
                "m7": {
                    "description": "Accordo minore con settima minore",
                    "character": "Sonorità jazzica standard, 'bluesy'",
                    "function": "Tonica minore o sottodominante",
                    "practice_tips": ["Ascolta la settima minore (10 semitoni dalla fondamentale)",
                                      "Cm7 vs Cmaj7: settima minore più 'grounded'"]
                },
                "7": {
                    "description": "Accordo di dominante (settima minore)",
                    "character": "Sonorità instabile, richiede risoluzione",
                    "function": "Dominante (V chord)",
                    "practice_tips": ["Ascolta il carattere 'instabile' che richiede risoluzione",
                                      "C7 risolve naturalmente su F o Fm"]
                },
                "m7b5": {
                    "description": "Accordo semidiminuito (half-diminished)",
                    "character": "Sonorità misteriosa, jazzica complessa",
                    "function": "Sottodominante minore in II-V-I",
                    "practice_tips": ["Ascolta la combinazione terza minore + quinta diminuita",
                                      "Dm7b5 risolve su G7"]
                }
            },
            
            # Estensioni Jazz
            "jazz_extensions": {
                "9": {
                    "description": "Estensione di 9° (2° ottava più alta)",
                    "character": "Aggiunge colore senza cambiare funzione",
                    "practice_tips": ["Cmaj9 è ancora maggiore, solo più ricco",
                                      "Ascolta il carattere 'aperto' della 9°"]
                },
                "11": {
                    "description": "Estensione di 11° (4° ottava più alta)",
                    "character": "Aggiunge carattere 'modal' o 'quartal'",
                    "practice_tips": ["Fmaj7#11 ha carattere Lydian",
                                      "La #11 è tipica del modo Lydian"]
                },
                "13": {
                    "description": "Estensione di 13° (6° ottava più alta)",
                    "character": "Aggiunge carattere 'bluesy' o jazzico",
                    "practice_tips": ["G13 è ancora dominante, solo più complesso",
                                      "La 13° è la 6° ottava più alta"]
                }
            },
            
            # Alterazioni
            "alterations": {
                "alt": {
                    "description": "Accordo alterato (b9, #9, b5, #5)",
                    "character": "Sonorità molto dissonante, jazzica moderna",
                    "function": "Dominante alterata per maggiore tensione",
                    "practice_tips": ["Ascolta le alterazioni come 'tensioni'",
                                      "Gli accordi alterati risolvono su accordi minori"]
                },
                "b9": {
                    "description": "Alterazione di 9° minore",
                    "character": "Sonorità aspra, bluesy",
                    "practice_tips": ["C7b9 ha carattere più 'blues' rispetto a C7",
                                      "La b9 crea maggiore tensione"]
                },
                "#9": {
                    "description": "Alterazione di 9° maggiore",
                    "character": "Sonorità molto dissonante",
                    "practice_tips": ["C7#9 è il 'chord Hendrix'",
                                      "La #9 crea carattere molto 'rock'"]
                }
            },
            
            # Progressioni
            "progressions": {
                "ii_v_i": {
                    "description": "Progressione II-V-I (la più comune nel jazz)",
                    "character": "Flow naturale, risoluzione standard",
                    "examples": ["Autumn Leaves", "molti standard jazz"],
                    "practice_tips": ["Ascolta il movimento del basso: 2° → 5° → 1°",
                                      "La progressione crea senso di 'home'"]
                },
                "i_iv_v_i": {
                    "description": "Progressione I-IV-V-I (pop/rock)",
                    "character": "Flow semplice, potente",
                    "examples": ["Molti brani pop", "rock classico"],
                    "practice_tips": ["Ascolta il movimento del basso: 1° → 4° → 5° → 1°",
                                      "La progressione crea senso di 'ciclo'"]
                }
            }
        }
    
    def get_suggestion(self, error_category: Optional[ErrorCategory],
                      current_level: DifficultyLevel,
                      recent_errors: List[ErrorCategory]) -> str:
        """
        Genera un suggerimento teorico personalizzato.
        
        Args:
            error_category: Categoria dell'errore corrente (None se risposta corretta)
            current_level: Livello corrente dell'utente
            recent_errors: Lista di errori recenti (ultimi 10)
        
        Returns:
            Suggerimento teorico personalizzato
        """
        if error_category:
            # Suggerimento per errore specifico
            base_suggestion = self.error_classifier.get_suggestion_for_error(error_category)
            
            # Aggiungi approfondimento basato sul livello
            level_insight = self._get_level_insight(current_level, error_category)
            
            return f"{base_suggestion}\n\n{level_insight}"
        
        else:
            # Risposta corretta - suggerimento per progresso
            if recent_errors:
                pattern = self.error_classifier.get_error_pattern(recent_errors)
                if pattern:
                    return self._get_progress_suggestion(pattern, current_level)
            
            # Suggerimento generale per livello
            return self._get_level_general_suggestion(current_level)
    
    def _to_difficulty_level(self, level):
        """Converte stringa o Enum in DifficultyLevel."""
        if isinstance(level, DifficultyLevel):
            return level
        try:
            return DifficultyLevel(level)
        except (ValueError, KeyError):
            return DifficultyLevel.TRIADS_BASIC

    def _get_level_insight(self, level: DifficultyLevel, error_category: ErrorCategory) -> str:
        """Restituisce insight specifico per livello"""
        level = self._to_difficulty_level(level)
        insights = {
            DifficultyLevel.TRIADS_BASIC: {
                ErrorCategory.MAJOR_MINOR_CONFUSION: "Nelle triadi, la terza è la differenza principale. Concentrati sul carattere 'aperto' vs 'misterioso'.",
                ErrorCategory.OTHER: "Le triadi sono la base di tutta l'armonia. Padroneggiare triadi maggiori/minori è fondamentale."
            },
            DifficultyLevel.SEVENTHS_DROP2: {
                ErrorCategory.SEVENTH_CONFUSION: "Le settime aggiungono carattere jazzico. Maj7=sofisticato, m7=jazz standard, 7=instabile.",
                ErrorCategory.VOICING_CONFUSION: "Drop2 voicing distribuisce le voci. Ascolta come cambia il carattere ma non la funzione."
            },
            DifficultyLevel.JAZZ_EXTENSIONS: {
                ErrorCategory.EXTENSION_CONFUSION: "Le estensioni (9,11,13) aggiungono colore. La funzione armonica rimane la stessa.",
                ErrorCategory.ALTERATION_CONFUSION: "Le alterazioni creano tensioni jazziche moderne. Ascolta il carattere 'dissonante'."
            },
            DifficultyLevel.ADVANCED_SUBS: {
                ErrorCategory.PROGRESSION_CONFUSION: "Le sostituzioni alterano il flow ma mantengono la funzione. Ascolta le nuove tensioni.",
                ErrorCategory.ROOT_CONFUSION: "In sostituzioni complesse, il root può cambiare. Ascolta il nuovo centro tonale."
            }
        }
        
        level_insights = insights.get(level, {})
        return level_insights.get(error_category, 
                                  f"Continua a praticare nel livello {level.value}!")
    
    def _get_progress_suggestion(self, error_pattern: ErrorCategory,
                                level: DifficultyLevel) -> str:
        """Suggerimento per pattern di progresso"""
        level = self._to_difficulty_level(level)
        pattern_suggestions = {
            ErrorCategory.MAJOR_MINOR_CONFUSION: f"Hai mostrato progresso nelle triadi! Ora concentrati sulle settime nel livello {level.value}.",
            ErrorCategory.SEVENTH_CONFUSION: f"Hai migliorato il riconoscimento delle settime! Prova le estensioni per maggiore complessità.",
            ErrorCategory.EXTENSION_CONFUSION: f"Hai padroneggiato le estensioni! Ora affronta le alterazioni per jazz più avanzato.",
            ErrorCategory.ALTERATION_CONFUSION: f"Hai migliorato con le alterazioni! Sei pronto per sostituzioni complesse."
        }
        
        return pattern_suggestions.get(error_pattern,
                                       f"Hai mostrato progresso nel livello {level.value}! Continua così!")
    
    def _get_level_general_suggestion(self, level: DifficultyLevel) -> str:
        """Suggerimento generale per livello"""
        level = self._to_difficulty_level(level)
        general_suggestions = {
            DifficultyLevel.TRIADS_BASIC: "Benissimo con le triadi! Prova il livello delle settime per sonorità più jazziche.",
            DifficultyLevel.SEVENTHS_DROP2: "Ottimo con le settime! Il livello delle estensioni aggiungerà colore jazzico.",
            DifficultyLevel.JAZZ_EXTENSIONS: "Fantastico con le estensioni! Le alterazioni nel livello avanzato ti prepareranno al jazz moderno.",
            DifficultyLevel.ADVANCED_SUBS: "Eccellente con le sostituzioni! Hai raggiunto un livello avanzato di ear training jazzico."
        }
        
        return general_suggestions.get(level, "Continua a praticare! L'orecchio armonico si sviluppa con pratica regolare.")
    
    def get_theory_explanation(self, chord_or_progression: str,
                              exercise_type: ExerciseType) -> str:
        """
        Restituisce una spiegazione teorica per un accordo/progressione.
        
        Args:
            chord_or_progression: Accordo o progressione
            exercise_type: Tipo di esercizio
        
        Returns:
            Spiegazione teorica
        """
        if exercise_type == ExerciseType.SINGLE_CHORD:
            return self._explain_chord(chord_or_progression)
        else:
            return self._explain_progression(chord_or_progression)
    
    def _explain_chord(self, chord: str) -> str:
        """Spiega un accordo singolo"""
        # Analizza l'accordo
        chord_info = self.error_classifier._analyze_chord(chord)
        if not chord_info:
            return f"{chord} è un accordo musicale. Ascolta il suo carattere unico."
        
        quality = chord_info['quality']
        extensions = chord_info['extensions']
        
        # Costruisce spiegazione
        explanation_parts = []
        
        if quality in self.theory_knowledge['triads']:
            triad_info = self.theory_knowledge['triads'][quality]
            explanation_parts.append(triad_info['description'])
            explanation_parts.append(f"Carattere: {triad_info['character']}")
        
        if chord_info['seventh_type'] and chord_info['seventh_type'] in self.theory_knowledge['seventh_chords']:
            seventh_info = self.theory_knowledge['seventh_chords'][chord_info['seventh_type']]
            explanation_parts.append(seventh_info['description'])
            explanation_parts.append(f"Funzione: {seventh_info['function']}")
        
        if extensions:
            for ext in extensions:
                if ext in self.theory_knowledge['jazz_extensions']:
                    ext_info = self.theory_knowledge['jazz_extensions'][ext]
                    explanation_parts.append(ext_info['description'])
        
        if chord_info['has_alterations']:
            alt_info = self.theory_knowledge['alterations']
            explanation_parts.append("Questo accordo contiene alterazioni jazziche.")
        
        if not explanation_parts:
            explanation_parts.append(f"{chord} è un accordo musicale con carattere unico.")
        
        return "\n".join(explanation_parts)
    
    def _explain_progression(self, progression: str) -> str:
        """Spiega una progressione"""
        chords = progression.split('|')
        chord_explanations = []
        
        for chord in chords:
            chord_explanation = self._explain_chord(chord)
            chord_explanations.append(f"{chord}: {chord_explanation}")
        
        # Identifica tipo di progressione
        if len(chords) == 4:
            if chords[0].endswith('m') and chords[1].endswith('m') and chords[2].endswith('7') and chords[3].endswith('m'):
                prog_info = self.theory_knowledge['progressions']['ii_v_i']
                progression_type = "Progressione II-V-I (jazz standard)"
            elif not chords[0].endswith('m') and chords[3] == chords[0]:
                prog_info = self.theory_knowledge['progressions']['i_iv_v_i']
                progression_type = "Progressione I-IV-V-I (pop/rock)"
            else:
                progression_type = "Progressione musicale"
        else:
            progression_type = "Progressione musicale"
        
        return f"{progression_type}\n\n" + "\n".join(chord_explanations)