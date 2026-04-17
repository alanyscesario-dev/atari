class GameAudio {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterVolume = this.ctx.createGain();
        this.masterVolume.connect(this.ctx.destination);
        this.masterVolume.gain.value = 0.2;
    }

    playNote(freq, duration, type = 'square', volume = 1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterVolume);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // Pew pew sound
    playLaser() {
        this.playNote(880, 0.1, 'sawtooth');
        setTimeout(() => this.playNote(440, 0.1, 'sawtooth'), 50);
    }

    // Power up sound
    playPowerUp() {
        this.playNote(440, 0.1, 'sine');
        setTimeout(() => this.playNote(554, 0.1, 'sine'), 100);
        setTimeout(() => this.playNote(659, 0.2, 'sine'), 200);
    }

    // Star Wars theme chiptune (simplified start)
    playMainTheme() {
        const tempo = 120;
        const quarter = 60 / tempo;
        
        const notes = [
            { f: 293, d: quarter }, { f: 293, d: quarter }, { f: 293, d: quarter },
            { f: 392, d: quarter * 2 }, { f: 587, d: quarter * 2 },
            { f: 523, d: quarter / 2 }, { f: 493, d: quarter / 2 }, { f: 440, d: quarter / 2 },
            { f: 783, d: quarter * 2 }, { f: 587, d: quarter },
            { f: 523, d: quarter / 2 }, { f: 493, d: quarter / 2 }, { f: 440, d: quarter / 2 },
            { f: 783, d: quarter * 2 }, { f: 587, d: quarter },
            { f: 523, d: quarter / 2 }, { f: 493, d: quarter / 2 }, { f: 523, d: quarter / 2 },
            { f: 440, d: quarter * 2 }
        ];

        let time = this.ctx.currentTime;
        notes.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(note.f, time);
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + note.d);
            osc.connect(gain);
            gain.connect(this.masterVolume);
            osc.start(time);
            osc.stop(time + note.d);
            time += note.d;
        });
    }
}

const audio = new GameAudio();
