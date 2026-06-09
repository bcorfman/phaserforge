function installJsdomCanvasStubs() {
  if (typeof window === 'undefined') return;

  const htmlCanvasProto = window.HTMLCanvasElement?.prototype as (HTMLCanvasElement & { __phaserforgePatched?: boolean }) | undefined;
  if (htmlCanvasProto && !htmlCanvasProto.__phaserforgePatched) {
    const context2d = {
      canvas: null as HTMLCanvasElement | null,
      fillStyle: '#000000',
      globalAlpha: 1,
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      save() {},
      restore() {},
      scale() {},
      rotate() {},
      translate() {},
      transform() {},
      setTransform() {},
      resetTransform() {},
      clearRect() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      stroke() {},
      fill() {},
      drawImage() {},
      fillText() {},
      strokeText() {},
      measureText(text: string) {
        return { width: text.length * 8 } as TextMetrics;
      },
      createImageData(width = 1, height = 1) {
        return { data: new Uint8ClampedArray(width * height * 4), width, height } as ImageData;
      },
      getImageData(width = 1, height = 1) {
        return { data: new Uint8ClampedArray(width * height * 4), width, height } as ImageData;
      },
      putImageData() {},
    };

    Object.defineProperty(htmlCanvasProto, 'getContext', {
      configurable: true,
      value(this: HTMLCanvasElement, type: string) {
        if (type !== '2d') return null;
        context2d.canvas = this;
        return context2d;
      },
    });
    htmlCanvasProto.__phaserforgePatched = true;
  }

  if (typeof window.open !== 'function') {
    window.open = (() => null) as typeof window.open;
  }
}

installJsdomCanvasStubs();
