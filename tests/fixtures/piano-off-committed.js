// Frozen from the committed pre-Piano runtime, before 436e260 added the piano branch.
// Source: 6a3464cba6292031348a2f9dc386e77222e4f803:aim-dojo-main.js
// Unlike piano-off.js, this committed graph has no pending chip tune/drums branches.
// Source fixture only. Never load it from the page or regenerate from current runtime.

function dutyToWidth(d){ return 2*Math.max(0.05,Math.min(0.5,d))-1; }

function buildDrums(){
  if(drumsBuilt || !toneReady) return;
  try{
    drumBus=new Tone.Volume(-5).toDestination();
    kick=new Tone.MembraneSynth({pitchDecay:0.03,octaves:6,envelope:{attack:0.001,decay:0.22,sustain:0}}).connect(drumBus);
    const snFilt=new Tone.Filter(1800,'bandpass').connect(drumBus);
    snare=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.16,sustain:0}}).connect(snFilt);
    const hatFilt=new Tone.Filter(8000,'highpass').connect(drumBus);
    hat=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.03,sustain:0}}).connect(hatFilt);
    tick=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.001,decay:0.05,sustain:0,release:0.02}}).connect(tickVol=new Tone.Volume(TICK_VOL_DB).connect(drumBus));   // QUIET TICK: the same +3 dB trim, now HELD (tickVol) so the metronome alone can duck and swell back after a miss without touching drumBus (which missGrooveDuck owns)
    shotCue=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.001,decay:0.06,sustain:0,release:0.03}}).connect(new Tone.Volume(1).connect(drumBus));   // groove Phase 1 shot-timing feedback: its OWN voice + a distinct SINE timbre so it never voice-steals the (triangle) metronome tick
    bass=new Tone.Synth({oscillator:{type:CHIP_BASS?'triangle':'sawtooth'},envelope:{attack:0.006,decay:0.28,sustain:0.18,release:0.22}}).connect(CHIP_BASS?new Tone.Volume(CFG.chip.bassDb).connect(drumBus):new Tone.Filter(520,'lowpass').connect(new Tone.Volume(-6).connect(drumBus)));   // the chip triangle needs no filter; the off arm keeps the warm saw, 520 Hz lowpass and original trim
    // These three '8n' delays become fixed ~0.25 s slaps at construction, before the run sets BPM; an eighth at 28 BPM is 1.07 s. Dry auditions their absence without retiming the off arm.
    try{ arp=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.004,decay:0.16,sustain:0,release:0.14}}).connect(new Tone.Filter(4200,'lowpass').connect(CHIP_DRY?new Tone.Volume(-9).connect(drumBus):new Tone.FeedbackDelay({delayTime:'8n',feedback:0.2,wet:0.28}).connect(new Tone.Volume(-9).connect(drumBus)))); }catch(e){ arp=null; }   // CHORD-ARP BED (pass 3: ducked vol -6→-9 so the new TUNE hook can cut through; still bright enough to carry harmony)
    try{ tapSynth=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.002,decay:0.13,sustain:0,release:0.08}}).connect(new Tone.Filter(3200,'lowpass').connect(new Tone.Volume(-11).connect(drumBus))); }catch(e){ tapSynth=null; }   // WASD taps get a VOICE (were silent): the off-beat "and" taps play a pentatonic counter-melody — playing well = playing music
    try{ pad=(CHIP_PAD?new Tone.Synth({oscillator:{type:'pulse',width:dutyToWidth(CFG.chip.padDuty)},envelope:{attack:0.35,decay:0.3,sustain:0.5,release:0.8}}):new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle'},envelope:{attack:0.35,decay:0.3,sustain:0.5,release:0.8}})).connect(new Tone.Filter(1400,'lowpass').connect(new Tone.Volume(-17).connect(drumBus))); }catch(e){ pad=null; }   // one pulse channel cycles the chord when auditioned; the off arm keeps the original polyphonic triangle, envelope, filter and trim
    try{ leadLp=new Tone.Filter(CHIP_LEAD?CFG.chip.leadLpHz:3800,'lowpass'); lead=new Tone.Synth({oscillator:CHIP_LEAD?{type:'pulse',width:dutyToWidth(CFG.chip.dutyFull)}:{type:'triangle'},envelope:{attack:0.004,decay:0.2,sustain:0.12,release:0.22}}).connect(leadLp.connect(CHIP_DRY?new Tone.Volume(-8).connect(drumBus):new Tone.FeedbackDelay({delayTime:'8n',feedback:0.18,wet:0.2}).connect(new Tone.Volume(-8).connect(drumBus)))); }catch(e){ lead=null; leadLp=null; }   // pulse duty carries tightness while the held filter stays at its safety cutoff; the off arm keeps the original triangle, 3800 Hz node and echo graph
    try{ tune=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.008,decay:0.18,sustain:0.08,release:0.28}}).connect(new Tone.Filter(5600,'lowpass').connect(CHIP_DRY?new Tone.Volume(-5).connect(drumBus):new Tone.FeedbackDelay({delayTime:'8n',feedback:0.12,wet:0.15}).connect(new Tone.Volume(-5).connect(drumBus)))); }catch(e){ tune=null; }   // HOOK melody (pass 3): sine + longer notes + light delay, sits ABOVE the arp bed; own voice so kills never cut the phrase
    drumsBuilt=true;
  }catch(e){ drumsBuilt=false; }
}
