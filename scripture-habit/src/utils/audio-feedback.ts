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
 * Gentle 2-note ascending chime on note submission
 */
export function playNoteSubmitSound(): void {
    if (!isSoundEnabled()) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        // E5 (659.25 Hz) -> A5 (880 Hz)
        playTone(ctx, 659.25, now, 0.28, 0.12);
        playTone(ctx, 880.00, now + 0.1, 0.45, 0.14);
    } catch (e) {
        console.warn('Audio feedback failed:', e);
    }
}

/**
 * Uplifting harmonic chord progression on reaching a study milestone
 */
export function playMilestoneSound(): void {
    if (!isSoundEnabled()) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        // C5 (523.25) -> E5 (659.25) -> G5 (783.99) -> C6 (1046.50)
        playTone(ctx, 523.25, now, 0.4, 0.12);
        playTone(ctx, 659.25, now + 0.12, 0.45, 0.14);
        playTone(ctx, 783.99, now + 0.24, 0.55, 0.15);
        playTone(ctx, 1046.50, now + 0.36, 0.85, 0.18);
    } catch (e) {
        console.warn('Milestone audio feedback failed:', e);
    }
}
