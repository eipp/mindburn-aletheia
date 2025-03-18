declare namespace jest {
  interface Matchers<R> {
    toBeValidAddress(): R;
    toBeBigIntCloseTo(target: bigint, delta: bigint): R;
  }
}

declare global {
  var __testContext: {
    initialBlock: number;
    startTime: number;
  };
} 