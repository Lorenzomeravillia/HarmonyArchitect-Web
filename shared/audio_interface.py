"""
Audio Interface Contract per architettura cross-platform.
Definisce l'interfaccia astratta per il playback audio che deve essere
implementata da ogni piattaforma (desktop, Android, etc.).
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Callable, Any

class PitchLike:
    """Interfaccia per oggetti simili a pitch (astrazione per music21.pitch)"""
    @property
    @abstractmethod
    def midi(self) -> int:
        """Restituisce il numero MIDI della nota"""
        pass
    
    @property
    @abstractmethod
    def frequency(self) -> float:
        """Restituisce la frequenza in Hz"""
        pass

class AudioInterface(ABC):
    """Interfaccia astratta per engine audio cross-platform"""
    
    @abstractmethod
    def __init__(self):
        """Inizializza l'engine audio per la piattaforma specifica"""
        pass
    
    @abstractmethod
    def play_pitches(self, pitches: List[PitchLike], duration: float = 2.0, 
                    arpeggio: bool = False, arpeggio_delay: float = 0.35,
                    ui_callback: Optional[Callable[[int], None]] = None,
                    done_callback: Optional[Callable[[], None]] = None) -> None:
        """
        Suona un singolo accordo (o arpeggio) in modo asincrono.
        
        Args:
            pitches: Lista di pitch da suonare
            duration: Durata in secondi
            arpeggio: Se True, suona come arpeggio
            arpeggio_delay: Ritardo tra note in arpeggio (secondi)
            ui_callback: Callback per aggiornamento UI (riceve indice accordo)
            done_callback: Callback quando la riproduzione è completata
        """
        pass
    
    @abstractmethod
    def play_progression(self, chords: List[List[PitchLike]], duration: float = 1.2,
                        delay_between: float = 0.1, arpeggio: bool = False,
                        arpeggio_delay: float = 0.35,
                        ui_callback: Optional[Callable[[int], None]] = None,
                        done_callback: Optional[Callable[[], None]] = None) -> None:
        """
        Suona una progressione di accordi in modo asincrono.
        
        Args:
            chords: Lista di accordi (ogni accordo è lista di pitch)
            duration: Durata di ogni accordo in secondi
            delay_between: Ritardo tra accordi in secondi
            arpeggio: Se True, suona come arpeggio
            arpeggio_delay: Ritardo tra note in arpeggio (secondi)
            ui_callback: Callback per aggiornamento UI (riceve indice accordo)
            done_callback: Callback quando la riproduzione è completata
        """
        pass
    
    @abstractmethod
    def play_voice_layer(self, chords: List[List[PitchLike]], voice_idx: int,
                        is_progression: bool, duration: float = 1.2,
                        delay_between: float = 0.6,
                        ui_callback: Optional[Callable[[int], None]] = None) -> None:
        """
        Suona solo una voce specifica dell'accordo/progressione.
        
        Args:
            chords: Accordi o progressione
            voice_idx: Indice della voce da suonare (0=basso)
            is_progression: True se è una progressione
            duration: Durata in secondi
            delay_between: Ritardo tra accordi in progressione
            ui_callback: Callback per aggiornamento UI
        """
        pass
    
    @abstractmethod
    def play_frequency(self, freq: float, duration: float = 1.5) -> None:
        """
        Suona una frequenza specifica (per note cliccabili).
        
        Args:
            freq: Frequenza in Hz
            duration: Durata in secondi
        """
        pass
    
    @abstractmethod
    def set_instrument_program(self, channel: int, program: int) -> None:
        """
        Imposta il programma MIDI per un canale specifico.
        
        Args:
            channel: Canale MIDI (0-6 per 7 voci)
            program: Programma MIDI GM (0-127)
        """
        pass
    
    @abstractmethod
    def stop_playback(self) -> None:
        """Ferma immediatamente qualsiasi riproduzione in corso."""
        pass
    
    @abstractmethod
    def cleanup(self) -> None:
        """Pulizia risorse audio (chiamare prima di terminare)."""
        pass