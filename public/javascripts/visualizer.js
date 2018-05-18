/*
 * Copyright 2013 Boris Smus. All Rights Reserved.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


var WIDTH = 640;
var HEIGHT = 360;

// Interesting parameters to tweak!
var SMOOTHING = 0.8;
var FFT_SIZE = 2048;

function Visualizer() {
    this.analyser = context.createAnalyser();
    this.filter = context.createBiquadFilter();
    this.distortion = context.createWaveShaper();
    this.convolver = context.createConvolver();
    this.gainNode = context.createGain();

    this.analyser.minDecibels = -140;
    this.analyser.maxDecibels = 0;
    loadSounds(this, {
        buffer: '/yanny-laurel-single.wav'
    }, onLoaded);
    this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
    this.times = new Uint8Array(this.analyser.frequencyBinCount);

    function onLoaded() {
        var button = document.querySelector('#btnResumeOrPause');
        button.removeAttribute('disabled');
        var buttonFilter = document.querySelector('#btnFilter');
        buttonFilter.removeAttribute('disabled');
        button.innerHTML = 'Play/pause';
        buttonFilter.innerHTML = 'Filter/Non-Filter';
    };

    this.isPlaying = false;
    this.isFiltered = false;
    this.startTime = 0;
    this.startOffset = 0;
}

Visualizer.prototype.toggleFilter = function () {

    this.source.disconnect(0);
    this.filter.disconnect(0);

    if (this.isFiltered) {
        this.source.connect(this.analyser);
        this.analyser.connect(context.destination);
    }
    else {
        try {
            this.filter.type = this.filter.HIGHPASS; // Low-pass filter. See BiquadFilterNode docs
            this.filter.frequency.value = 5000;
            this.source.connect(this.filter);
            // this.analyser.connect(this.distortion);
            // this.distortion.connect(this.filter);
            // this.filter.connect(this.convolver);
            // this.convolver.connect(this.gainNode);
            // this.gainNode.connect(context.destination);
            //this.analyser.connect(context.destination);
            //this.analyser.connect(this.filter);
            this.filter.connect(this.analyser);
            this.analyser.connect(context.destination);
        }
        catch (ex) {
            alert(ex);
        }
    }
    this.isFiltered = !this.isFiltered;
}

Visualizer.prototype.changeFrequency = function(element) {
    // Clamp the frequency between the minimum value (40 Hz) and half of the
    // sampling rate.
    var minValue = 40;
    var maxValue = context.sampleRate;
    // Logarithm (base 2) to compute how many octaves fall in the range.
    var numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
    // Compute a multiplier from 0 to 1 based on an exponential scale.
    var multiplier = Math.pow(2, numberOfOctaves * (element.value - 1.0));
    // Get back to the frequency value between min and max.
    this.filter.frequency.value = maxValue * multiplier;
  };

// Toggle playback
Visualizer.prototype.togglePlayback = function () {
    if (this.isPlaying) {
        // Stop playback
        this.source[this.source.stop ? 'stop' : 'noteOff'](0);
        this.startOffset += context.currentTime - this.startTime;
        console.log('paused at', this.startOffset);
        // Save the position of the play head.
    } else {
        try {
            this.startTime = context.currentTime;
            console.log('started at', this.startOffset);
            this.source = context.createBufferSource();
            // Connect graph
            this.source.connect(this.analyser);
            this.source.buffer = this.buffer;
            this.source.loop = true;
            // Start playback, but make sure we stay in bound of the buffer.
            this.source[this.source.start ? 'start' : 'noteOn'](0, this.startOffset % this.buffer.duration);
            // Start visualizer.
            this.analyser.connect(context.destination);
            requestAnimFrame(this.draw.bind(this));
        }
        catch (ex) {
            alert(ex);
        }

    }
    this.isPlaying = !this.isPlaying;
}

Visualizer.prototype.draw = function () {

    try {
        this.analyser.smoothingTimeConstant = SMOOTHING;
        this.analyser.fftSize = FFT_SIZE;

        // Get the frequency data from the currently playing music
        this.analyser.getByteFrequencyData(this.freqs);
        this.analyser.getByteTimeDomainData(this.times);

        var width = Math.floor(1 / this.freqs.length, 10);

        var canvas = document.querySelector('canvas');
        var drawContext = canvas.getContext('2d');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        // Draw the frequency domain chart.
        for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
            var value = this.freqs[i];
            var percent = value / 256;
            var height = HEIGHT * percent;
            var offset = HEIGHT - height - 1;
            var barWidth = WIDTH / this.analyser.frequencyBinCount;
            var hue = i / this.analyser.frequencyBinCount * 360;
            drawContext.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
            drawContext.fillRect(i * barWidth, offset, barWidth, height);
        }

        // Draw the time domain chart.
        for (var i = 0; i < this.analyser.frequencyBinCount; i++) {
            var value = this.times[i];
            var percent = value / 256;
            var height = HEIGHT * percent;
            var offset = HEIGHT - height - 1;
            var barWidth = WIDTH / this.analyser.frequencyBinCount;
            drawContext.fillStyle = 'white';
            drawContext.fillRect(i * barWidth, offset, 1, 2);
        }

        if (this.isPlaying) {
            requestAnimFrame(this.draw.bind(this));
        }
    }
    catch (ex) {
        alert(ex);
    }
}

Visualizer.prototype.getFrequencyValue = function (freq) {
    var nyquist = context.sampleRate / 2;
    var index = Math.round(freq / nyquist * this.freqs.length);
    return this.freqs[index];
}
