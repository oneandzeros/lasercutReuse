declare module 'potrace' {
  export interface PotraceOptions {
    threshold?: number;
    turdSize?: number;
    optTolerance?: number;
    optCurve?: boolean;
    turnPolicy?: string;
  }

  export function trace(
    image: string,
    options: PotraceOptions,
    callback: (error: Error | null, svg: string) => void
  ): void;

  const Potrace: {
    trace: typeof trace;
  };

  export default Potrace;
}
