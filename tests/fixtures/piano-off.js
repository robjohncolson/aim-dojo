// Frozen before the Piano P0/P1 changes from the as-found snapshot (including dirty chip changes).
// Snapshot: aim-dojo-piano-1677121219a146d3a15f8d2b518fa7da/aim-dojo-main.js
// These functions are source fixtures only. Never call them here or regenerate from current runtime.

function dutyToWidth(d){ return 2*Math.max(0.05,Math.min(0.5,d))-1; }

function buildDrums(){
  if(drumsBuilt || !toneReady) return;
  try{
    drumBus=new Tone.Volume(-5).toDestination();
    kick=CHIP_DRUMS?new Tone.Synth({oscillator:{type:'pulse',width:dutyToWidth(CFG.chip.dutyFull)},envelope:{attack:0.001,decay:0.16,sustain:0,release:0.04}}).connect(drumBus):new Tone.MembraneSynth({pitchDecay:0.03,octaves:6,envelope:{attack:0.001,decay:0.22,sustain:0}}).connect(drumBus);   // a 50% pulse with a pitch drop stands in for the analog membrane; the off arm keeps the 808 thud
    const snFilt=new Tone.Filter(CHIP_DRUMS?4000:1800,CHIP_DRUMS?'highpass':'bandpass').connect(drumBus);
    snare=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:CHIP_DRUMS?0.08:0.16,sustain:0}}).connect(snFilt);   // chip snare is CH4-bright (highpass, short); the off arm keeps the 1800 Hz body
    const hatFilt=new Tone.Filter(CHIP_DRUMS?10000:8000,'highpass').connect(drumBus);
    hat=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:CHIP_DRUMS?0.02:0.03,sustain:0}}).connect(hatFilt);
    tick=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.001,decay:0.05,sustain:0,release:0.02}}).connect(tickVol=new Tone.Volume(TICK_VOL_DB).connect(drumBus));   // QUIET TICK: stays the high triangle woodblock on both arms — a 12.5% pulse at these pitches (C7/G6) reads as a screech, not a click. Same +3 dB trim, now HELD (tickVol) so the metronome alone can duck and swell back after a miss without touching drumBus (which missGrooveDuck owns)
    shotCue=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.001,decay:0.06,sustain:0,release:0.03}}).connect(new Tone.Volume(1).connect(drumBus));   // groove Phase 1 shot-timing feedback: its OWN voice + a distinct SINE timbre so it never voice-steals the (triangle) metronome tick
    bass=new Tone.Synth({oscillator:{type:CHIP_BASS?'triangle':'sawtooth'},envelope:{attack:0.006,decay:0.28,sustain:0.18,release:0.22}}).connect(CHIP_BASS?new Tone.Volume(CFG.chip.bassDb).connect(drumBus):new Tone.Filter(520,'lowpass').connect(new Tone.Volume(-6).connect(drumBus)));   // the chip triangle needs no filter; the off arm keeps the warm saw, 520 Hz lowpass and original trim
    // These three '8n' delays become fixed ~0.25 s slaps at construction, before the run sets BPM; an eighth at 28 BPM is 1.07 s. Dry auditions their absence without retiming the off arm.
    try{ arp=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.004,decay:0.16,sustain:0,release:0.14}}).connect(new Tone.Filter(4200,'lowpass').connect(CHIP_DRY?new Tone.Volume(-9).connect(drumBus):new Tone.FeedbackDelay({delayTime:'8n',feedback:0.2,wet:0.28}).connect(new Tone.Volume(-9).connect(drumBus)))); }catch(e){ arp=null; }   // CHORD-ARP BED (pass 3: ducked vol -6→-9 so the new TUNE hook can cut through; still bright enough to carry harmony)
    try{ tapSynth=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.002,decay:0.13,sustain:0,release:0.08}}).connect(new Tone.Filter(3200,'lowpass').connect(new Tone.Volume(-11).connect(drumBus))); }catch(e){ tapSynth=null; }   // WASD taps get a VOICE (were silent): the off-beat "and" taps play a pentatonic counter-melody — playing well = playing music
    try{ pad=(CHIP_PAD?new Tone.Synth({oscillator:{type:'pulse',width:dutyToWidth(CFG.chip.padDuty)},envelope:{attack:0.35,decay:0.3,sustain:0.5,release:0.8}}):new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle'},envelope:{attack:0.35,decay:0.3,sustain:0.5,release:0.8}})).connect(new Tone.Filter(1400,'lowpass').connect(new Tone.Volume(-17).connect(drumBus))); }catch(e){ pad=null; }   // one pulse channel cycles the chord when auditioned; the off arm keeps the original polyphonic triangle, envelope, filter and trim
    try{ leadLp=new Tone.Filter(CHIP_LEAD?CFG.chip.leadLpHz:3800,'lowpass'); lead=new Tone.Synth({oscillator:CHIP_LEAD?{type:'pulse',width:dutyToWidth(CFG.chip.dutyFull)}:{type:'triangle'},envelope:{attack:0.004,decay:0.2,sustain:0.12,release:0.22}}).connect(leadLp.connect(CHIP_DRY?new Tone.Volume(-8).connect(drumBus):new Tone.FeedbackDelay({delayTime:'8n',feedback:0.18,wet:0.2}).connect(new Tone.Volume(-8).connect(drumBus)))); }catch(e){ lead=null; leadLp=null; }   // pulse duty carries tightness while the held filter stays at its safety cutoff; the off arm keeps the original triangle, 3800 Hz node and echo graph
    try{ tune=new Tone.Synth({oscillator:CHIP_TUNE?{type:'pulse',width:dutyToWidth(CFG.chip.tuneDuty)}:{type:'sine'},envelope:{attack:0.008,decay:0.18,sustain:0.08,release:0.28}}).connect(new Tone.Filter(CHIP_TUNE?CFG.chip.leadLpHz:5600,'lowpass').connect(CHIP_DRY?new Tone.Volume(-5).connect(drumBus):new Tone.FeedbackDelay({delayTime:'8n',feedback:0.12,wet:0.15}).connect(new Tone.Volume(-5).connect(drumBus)))); }catch(e){ tune=null; }   // HOOK melody (pass 3): pulse on the chip, sine off it; longer notes + light delay, sits ABOVE the arp bed; own voice so kills never cut the phrase
    drumsBuilt=true;
  }catch(e){ drumsBuilt=false; }
}

function initAudio(){
  ensureListener();
  if(!reverbInput && listener && !state.running){ try{ buildReverb(); }catch(e){} } else scheduleReverbBuild();
  if(audioInit){ if(rawCtx && rawCtx.state!=='running'){ try{ rawCtx.resume().catch(()=>{}); }catch(e){} } return; }   // retry the context resume: a pad-first start lacks the user gesture, and Firefox REJECTS that first resume outright — the next real click/keypress lands here and must issue a fresh one
  if(!window.Tone){ toneReady=false; loadToneOnce().catch(()=>{}); applyAudioState(); return; }
  audioInit=true;
  try{
    Tone.start();
    rawCtx = (Tone.getContext && Tone.getContext().rawContext) ? Tone.getContext().rawContext : null;
    const out=new Tone.Volume(-6).toDestination();
    synthHit=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.001,decay:0.09,sustain:0,release:0.02}}).connect(out);
    synthLow=new Tone.Synth({oscillator:{type:'square'},envelope:{attack:0.001,decay:0.14,sustain:0,release:0.03}}).connect(new Tone.Volume(-10).toDestination());
    synthLvl=new Tone.Synth({oscillator:{type:'sawtooth'},envelope:{attack:0.002,decay:0.12,sustain:0,release:0.05}}).connect(out);
    noiseFire=new Tone.NoiseSynth({noise:{type:'white'},envelope:{attack:0.001,decay:0.05,sustain:0}}).connect(new Tone.Volume(-16).toDestination());
    try{ chordSynth=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle'},envelope:{attack:0.005,decay:0.3,sustain:0.05,release:0.5}}).connect(new Tone.Volume(-13).toDestination()); }catch(e){ chordSynth=null; }
    try{ arcWhoosh=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.012,decay:0.12,sustain:0.35,release:0.14}}).connect(new Tone.Volume(-22).toDestination()); }catch(e){ arcWhoosh=null; }   // ARC flight whoosh (quieter bed under the new muzzle; pitch from theme scale)
    if(ML_DOOR_CROSS) try{ doorWhoosh=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:0.005,decay:0.13,sustain:0.18,release:0.06}}).connect(new Tone.Volume(DOOR_WHOOSH_DB).toDestination()); }catch(e){ doorWhoosh=null; }   // ONE build-time doorway voice: the per-crossing call only sweeps this shared triangle; the flat switch builds no node
    try{ fireMuzzle=new Tone.NoiseSynth({noise:{type:'brown'},envelope:{attack:0.001,decay:0.04,sustain:0,release:0.02}}).connect(new Tone.Filter(1600,'lowpass').connect(new Tone.Volume(-13).toDestination())); }catch(e){ fireMuzzle=null; }   // soft muzzle thump (brown noise — not a harsh white crack)
    try{ firePluck=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.001,decay:0.07,sustain:0,release:0.03}}).connect(new Tone.Volume(-10).toDestination()); }catch(e){ firePluck=null; }   // in-key pluck so the launch sits with the song
    toneReady=true;
  }catch(e){ toneReady=false; audioInit=false; }
  applyAudioState();
  if(CFG.chorus.on){ chorusSaltRefresh(); chorusEnsure(); }   // THE STANDING CHORUS is built WITH the graph, never on demand: its first moment used to be a mercy downbeat, so a PolySynth, a filter and a Volume were being constructed inside the Transport callback that had just asked it to sing. Built here it is born muted and costs nothing but memory until a moment opens the gate, and the salt is warm before any pick. Raw boolean first — parcel off builds no node
}

function sfx(kind){
  if(!soundOn || !toneReady) return;
  try{
    const now=Tone.now();
    if(kind==='hit'){ synthHit.triggerAttackRelease(880*Math.pow(2,Math.min(state.streak,12)/24),0.06,now); }
    else if(kind==='whiff'){ noiseFire.triggerAttackRelease(0.04,now); }
    else if(kind==='offbeat'){ synthLow.triggerAttackRelease(220,0.08,now); }   // late hit → in-key (A3), plain (not a buzz)
    else if(kind==='expire'){ synthLow.triggerAttackRelease(110,0.14,now); }     // missed entirely → low in-key (A2) drop
    else if(kind==='levelUp'){ synthLvl.triggerAttackRelease(523,0.08,now); synthLvl.triggerAttackRelease(784,0.10,now+0.09); }
    else if(kind==='levelDown'){ synthLvl.triggerAttackRelease(392,0.08,now); synthLvl.triggerAttackRelease(262,0.12,now+0.09); }
  }catch(e){}
}

function playHit(gradeIdx){                               // graded kill tone = the LEAD melody: kills walk UP the A-minor pentatonic with the streak, GRID-SNAPPED so the run locks to the beat. Falls back to synthHit if the lead voice failed to build.
  const v=lead||synthHit; if(!soundOn || !toneReady || !v) return;
  const shaped=CFG.voice.on && voiceLive();               // raw boolean at the call site first: the parcel off costs one read, no call, and the plain branch below is byte-for-byte today's note
  if(shaped){
    if(gradeIdx<=0){ if(_voiceStack<99) _voiceStack++; } else voiceBreak();
    if(voiceMuted()) return;                              // your clank still owns this beat: the note simply does not happen (the kill itself already scored, and the stack above still moved)
  }
  try{ const st=beatSnap(), s=Math.min(state.streak,23), root=PENTA[s%PENTA.length]*Math.pow(2,Math.floor(s/PENTA.length));
    if(shaped){
      const V=CFG.voice, q=voiceQ(), stack=Math.min(_voiceStack, Math.max(1,V.stackMax|0));
      if(CHIP_LEAD){ if(lead) lead.oscillator.width.value=dutyToWidth(CFG.chip.dutyEdge+(CFG.chip.dutyFull-CFG.chip.dutyEdge)*q); }
      else if(leadLp) leadLp.frequency.value=V.dullHz+(V.brightHz-V.dullHz)*q;   // one shared colour write per kill: pulse duty on the chip, the original cutoff off it; tank walking notes ride wherever the last kill left the instrument
      v.triggerAttackRelease(root, 0.16, st, V.breathyVel+(V.fullVel-V.breathyVel)*q);
      if(gradeIdx<=0){                                    // FLAWLESS: the octave sparkle, and from the 2nd consecutive one the consonance rolls up over it (grace notes, not a chord array — `lead` is monophonic)
        v.triggerAttackRelease(stack>=2?root*1.5:root*2, 0.08, st+0.05, 0.5);
        if(stack>=3) v.triggerAttackRelease(root*2, 0.08, st+0.1, 0.45);
      }
    }else{
      v.triggerAttackRelease(root, 0.16, st, gradeIdx<=0?0.95:gradeIdx===1?0.78:0.62);
      if(gradeIdx<=0) v.triggerAttackRelease(root*2, 0.08, st+0.05, 0.5);   // FLAWLESS sparkle (octave up)
    }
  }catch(e){}
}

function playFireLaunch(flightT){   // two-layer launch: soft muzzle + quieter in-key whoosh (sits with the theme, doesn't fight the bed)
  if(!soundOn || !toneReady) return;
  try{
    const now=Tone.now();
    const lo=(PENTA&&PENTA.length)?PENTA[0]:220;                 // theme scale root (or fallback A3)
    const hi=(PENTA&&PENTA.length)?PENTA[Math.min(4,PENTA.length-1)]:440;
    const sensei=true;   // SENSEI-only dojo (difficulty picker cut 2026-07-09)
    if(fireMuzzle) fireMuzzle.triggerAttackRelease(0.032, now, sensei?0.62:0.5);
    if(firePluck) firePluck.triggerAttackRelease(lo*2, '32n', now, sensei?0.78:0.65);   // octave up = clear “shot” without stealing the lead melody
    if(arcWhoosh){
      const ft=Math.max(0.18, Math.min(2.2, flightT||0.6));
      const a=lo*0.9, b=hi*1.05;
      arcWhoosh.triggerAttackRelease(a, ft, now, sensei?0.38:0.32);
      arcWhoosh.frequency.cancelScheduledValues(now);
      arcWhoosh.frequency.setValueAtTime(a, now);
      arcWhoosh.frequency.linearRampToValueAtTime(b, now+ft*0.85);
    }
  }catch(e){}
}
