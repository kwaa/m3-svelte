import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";
// Heavily inspired by crossfade from svelte/transition
interface transitionOptions {
  delay?: number;
  duration?: number;
  easing?: typeof cubicOut;
}
interface containerOptions {
  fallback?: (
    node: Element,
    params: transitionOptions & containerOptions,
    isLeaving: boolean
  ) => TransitionConfig;
}
interface containerParamOptions {
  key: string;
}
export const containerTransform = (options: transitionOptions & containerOptions) => {
  const haveStarted = new Map();
  const haveDelivered = new Map();
  const transform = (
    from: DOMRect,
    node: Element,
    params: transitionOptions & containerOptions & containerParamOptions,
    isLeaving: boolean
  ): TransitionConfig => {
    const to = node.getBoundingClientRect();
    const toCenter = [to.left + to.width / 2, to.top + to.height / 2];
    const fromCenter = [from.left + from.width / 2, from.top + from.height / 2];
    const dx = fromCenter[0] - toCenter[0];
    const dy = fromCenter[1] - toCenter[1];

    const style = getComputedStyle(node);
    const transform = style.transform === "none" ? "" : style.transform;
    return {
      delay: params.delay || options.delay,
      duration: params.duration || options.duration || 500,
      easing: params.easing || options.easing || cubicOut,
      css: (t, u) => {
        const currentWidth = to.width * (1 - u) + from.width * u;
        const currentHeight = to.height * (1 - u) + from.height * u;
        const widthOffset = (to.width - currentWidth) / 2;
        const heightOffset = (to.height - currentHeight) / 2;
        return `transform-origin: top-left;
transform: ${transform} translate(${u * dx}px, ${u * dy}px);
clip-path: inset(${heightOffset}px ${widthOffset}px ${heightOffset}px ${widthOffset}px);`;
      },
    };
  };
  const _makeTransition = (
    starting: typeof haveStarted,
    ending: typeof haveDelivered,
    isLeaving: boolean
  ) => {
    return (
      node: Element,
      params: transitionOptions & containerOptions & containerParamOptions
    ) => {
      starting.set(params.key, { rect: node.getBoundingClientRect() });
      return () => {
        if (ending.has(params.key)) {
          const { rect } = ending.get(params.key);
          ending.delete(params.key);
          return transform(rect, node, params, isLeaving);
        }
        starting.delete(params.key);
        const fallback = params.fallback || options.fallback;
        return fallback?.(node, params, isLeaving) || {}; // TODO: satisfy ts
      };
    };
  };
  return [
    _makeTransition(haveStarted, haveDelivered, true),
    _makeTransition(haveDelivered, haveStarted, false),
  ];
};

interface inOutOptions {
  start?: "top" | "bottom" | "left" | "right";
  moveY?: boolean;
}
export const enterExit = (
  node: Element,
  options: transitionOptions & inOutOptions
): TransitionConfig => {
  options.start ||= "top";
  options.moveY ??= true;
  const scaleDir = ["top", "bottom"].includes(options.start) ? "Y" : "X";
  const { borderRadius, boxShadow } = getComputedStyle(node);
  const radius =
    (borderRadius.endsWith("px")
      ? +borderRadius.slice(0, -2)
      : borderRadius.endsWith("rem")
      ? +borderRadius.slice(0, -3) * 16
      : null) || 0;
  const getClipPath = (n: string) => {
    const out = boxShadow && boxShadow != "none" ? "-100%" : "0";
    /* the above allows box shadows to show, ideally i would use a wrapper for this instead */
    if (options.start == "top") return `-100% ${out} ${n} ${out}`;
    else if (options.start == "bottom") return `${n} ${out} -100% ${out}`;
    else if (options.start == "left") return `${out} ${n} ${out} -100%`;
    else if (options.start == "right") return `${out} -100% ${out} ${n}`;
  };
  const getTransform = (u: number) => {
    if (!options.moveY) return "";
    if (options.start == "top") return `translateY(${u * -10}%)`;
    else if (options.start == "bottom") return `translateY(${u * 10}%)`;
    else if (options.start == "left") return `translateX(${u * -10}%)`;
    else if (options.start == "right") return `translateX(${u * 10}%)`;
  };
  return {
    delay: options.delay,
    duration: options.duration || 300,
    easing: options.easing || cubicOut,
    css: (t, u) => `clip-path: inset(${getClipPath(u * 100 + "%")} round ${radius}px);
transform-origin: ${options.start};
transform: scale${scaleDir}(${(t * 0.3 + 0.7) * 100}%) ${getTransform(u)};
opacity: ${Math.min(t * 3, 1)};`,
  };
};

interface heightOptions {
  height: number;
}
export const heightTransition = (node: Element, options: transitionOptions & heightOptions) => {
  return {
    delay: options.delay,
    duration: options.duration || 400,
    easing: options.easing || cubicOut,
    css: (t: number) => `height: ${t * options.height}px`,
  };
};

export const outroClass = (node: Element) => {
  const addClass = (e: Event) => {
    if (!(e.target instanceof Element)) return;
    e.target.classList.add("leaving");
  };
  const removeClass = (e: Event) => {
    if (!(e.target instanceof Element)) return;
    e.target.classList.remove("leaving");
  };
  node.addEventListener("outrostart", addClass);
  node.addEventListener("outroend", removeClass);
  return {
    destroy() {
      node.removeEventListener("outrostart", addClass);
      node.removeEventListener("outroend", removeClass);
    },
  };
};
