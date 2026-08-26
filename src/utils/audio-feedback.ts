/**
 * audio-feedback.ts
 * Lightweight, zero-asset sound feedback using Web Audio API synthesis.
 */

const STORAGE_KEY = 'scripture_habit_sound_enabled';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

export function isSoundEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== 'false'; // Default to true
}

export function setSoundEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}

/**
 * Play a single gentle bell/marimba chime tone
 */
function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, peakGain: number = 0.15): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
}

/**
 * Celebratory sound on note submission — a punchy "pop" burst,
 * simultaneous major chord, and high sparkle shimmer.
 */
export function playNoteSubmitSound(): void {
    if (!isSoundEnabled()) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // 1. pop burst
        playConfettiBurst(ctx, now);

        // 2. Simultaneous major chord (C5+E5+G5)
        const chordStart = now + 0.03;
        playTone(ctx, 523.25, chordStart, 0.5, 0.10);  // C5
        playTone(ctx, 659.25, chordStart, 0.5, 0.10);  // E5
        playTone(ctx, 783.99, chordStart, 0.5, 0.10);  // G5

        // 3. High sparkle shimmer
        playTone(ctx, 1318.51, chordStart + 0.05, 0.3, 0.06);  // E6
        playTone(ctx, 1567.98, chordStart + 0.12, 0.25, 0.05); // G6
        playTone(ctx, 2093.00, chordStart + 0.18, 0.35, 0.04); // C7
    } catch (e) {
        console.warn('Audio feedback failed:', e);
    }
}

/**
 * Percussive "pop" burst — the sound of confetti exploding out.
 * Uses filtered white noise with a punchy envelope.
 */
function playConfettiBurst(ctx: AudioContext, startTime: number): void {
    // Dual-band noise burst to make the "パン" clearly audible in different
    // playback environments: a sharp high-frequency crack and a short
    // mid/low body for the transient punch.
    const duration = 0.09; // 90ms total — slightly longer for fuller transient
    const sampleRate = ctx.sampleRate;
    const bufferLength = Math.ceil(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferLength, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferLength; i++) {
        // slight taper to reduce harsh end clicks
        const env = 1 - i / bufferLength;
        data[i] = (Math.random() * 2 - 1) * env;
    }

    // High-frequency "crack" (sharp, very short attack)
    const srcHigh = ctx.createBufferSource();
    srcHigh.buffer = buffer;
    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'bandpass';
    // tune for a sharper, more prominent crack
    highFilter.frequency.setValueAtTime(3600, startTime);
    // `Q` is an AudioParam on BiquadFilterNode; call setValueAtTime directly.
    if (highFilter.Q && typeof highFilter.Q.setValueAtTime === 'function') {
        highFilter.Q.setValueAtTime(1.8, startTime);
    }
    const gainHigh = ctx.createGain();
    gainHigh.gain.setValueAtTime(0, startTime);
    // raise high peak for more perceived "パン"
    gainHigh.gain.linearRampToValueAtTime(1.0, startTime + 0.002);
    gainHigh.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    srcHigh.connect(highFilter);
    highFilter.connect(gainHigh);
    gainHigh.connect(ctx.destination);
    srcHigh.start(startTime);
    srcHigh.stop(startTime + duration);

    // Low/mid "body" (gives the pop a weight so it's heard on small speakers)
    const srcLow = ctx.createBufferSource();
    srcLow.buffer = buffer;
    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'bandpass';
    // low/mid body tuned slightly lower for small speakers
    lowFilter.frequency.setValueAtTime(500, startTime);
    if (lowFilter.Q && typeof lowFilter.Q.setValueAtTime === 'function') {
        lowFilter.Q.setValueAtTime(0.9, startTime);
    }
    const gainLow = ctx.createGain();
    gainLow.gain.setValueAtTime(0, startTime);
    // increase body so the transient is audible on phone speakers
    gainLow.gain.linearRampToValueAtTime(0.6, startTime + 0.003);
    gainLow.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    srcLow.connect(lowFilter);
    lowFilter.connect(gainLow);
    gainLow.connect(ctx.destination);
    srcLow.start(startTime);
    srcLow.stop(startTime + duration);
}

/**
 * Crisp 2-note ascending pop on unread messages (LINE-style "Pikon")
 */
export function playUnreadNotificationSound(): void {
    if (!isSoundEnabled()) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        // F6 (1396.91 Hz) -> C7 (2093.00 Hz)
        playTone(ctx, 1396.91, now, 0.08, 0.12);
        playTone(ctx, 2093.00, now + 0.06, 0.18, 0.15);
    } catch (e) {
        console.warn('Unread notification audio feedback failed:', e);
    }
}

