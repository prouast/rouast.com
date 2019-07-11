import {VideoBuffer} from './buffer.js';

// The number of frames used for prediction.
const NUM_FRAMES = 16;

/**
 * Demo for intake gesture detection
 */
export class Demo {
  constructor(webcamId) {
    this.webcamId = webcamId;
  }

  async init() {
    try {
      const webcamConfig = {
        facingMode: 'user',
        resizeWidth: 128.0,
        resizeHeight: 128.0,
        centerCrop: true
      }
      this.webcam = await tf.data.webcam(document.getElementById(this.webcamId), webcamConfig);
    } catch (e) {
      console.log(e);
    }

    this.isPredicting = false;
    this.videoBuffer = new VideoBuffer(NUM_FRAMES);
    this.timer = setInterval(this.pushFrame.bind(this), 125);
    this.model = await tf.loadLayersModel('./model/model.json');
  }

  standardize(frames) {
    const num_pixels = tf.prod(frames.shape);
    const mean = tf.mean(frames);
    const stddev = tf.sqrt(tf.relu(tf.sub(tf.mean(tf.square(frames)), tf.square(mean))))
    const min_stddev = tf.rsqrt(tf.cast(num_pixels, 'float32'))
    const pixel_value_scale = tf.maximum(stddev, min_stddev)
    const normFrames = tf.div(tf.sub(frames, mean), pixel_value_scale);
    return normFrames;
  }

  // Push a frame into the videoBuffer
  async pushFrame() {
    const frame = await this.webcam.capture();
    const ready = tf.tidy(() => this.videoBuffer.updateWithFrame(frame));
    frame.dispose();
    if (ready && !this.isPredicting) {
      // Ready for prediction
      this.isPredicting = true;
      this.predict();
    }
  }

  async predict() {
    while (this.isPredicting) {
      // Get input frames
      // Try 2D model why maxPool3D is not supported yet
      const frame = this.videoBuffer.frames.slice(NUM_FRAMES - 1);
      // Normalize the frames
      const normFrame = tf.tidy(() => this.standardize(frame.toFloat()));
      frame.dispose();
      // const t0 = performance.now();
      // Run inference
      const logits = this.model.predict(normFrame);
      normFrame.dispose();
      const p = tf.softmax(logits.flatten());
      // const t1 = performance.now();
      // console.log("inference took " + (t1 - t0) + " milliseconds.");
      // console.log('tf.memory(): ', tf.memory());

      await tf.nextFrame();
      p.print();
    }
  }

  stop() {
    this.isPredicting = false;
    clearInterval(this.timer);
    this.webcam.stop();
  }
}