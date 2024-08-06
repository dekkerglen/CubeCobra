export {};

declare global {
  interface Window {
    globalShowTagColors?: boolean;
    nitroAds: {
      createAd(id: string, options: NitroAdOptions): NitroAd | Promise<NitroAd> | Promise<NitroAd[]> | null;
    };
  }
}

interface NitroAd extends object {}

interface NitroAdOptions {
  acceptable?: boolean;
  anchor?: AnchorPositionOptions;
  anchorBgColor?: string;
  anchorClose?: boolean;
  anchorPersistClose?: boolean;
  className?: string;
  contentRating?: string;
  delayLoading?: boolean;
  demo?: boolean;
  floating?: FloatingOptions;
  format: FormatOptions;
  frequencyCap?: number;
  geoAllow?: string[];
  geoDeny?: string[];
  group?: string;
  interstitial?: InterstitialOptions;
  keywords?: string;
  mediaQuery?: string;
  outstream?: OutstreamOptions;
  pageInterval?: number;
  rail?: string;
  railCollisionWhitelist?: string[];
  railDistance?: number;
  railOffsetBottom?: number;
  railOffsetTop?: number;
  railSpacing?: number;
  railStack?: boolean;
  refreshDisabled?: string[];
  refreshLimit?: number;
  refreshTime?: number;
  refreshVisibleOnly?: boolean;
  renderVisibleOnly?: boolean;
  report?: ReportOptions;
  rewarded?: RewardedOptions;
  sizes: [string, string][];
  skipBidders?: string[];
  stickyStackLimit?: number;
  stickyStackOffset?: number;
  stickyStackResizable?: boolean;
  stickyStackSpace?: number;
  targeting?: PlacementTargeting;
  title?: string;
  video?: VideoOptions;
  visibleMargin?: number;
}

interface AnchorPositionOptions extends object {}

interface FloatingOptions extends object {}

interface FormatOptions extends object {}

interface InterstitialOptions {
  triggers?: {
    unhideWindow?: boolean;
  };
}

interface OutstreamOptions extends object {}

interface ReportOptions extends object {}

interface RewardedOptions extends object {}

interface PlacementTargeting {
  [key: string]: string | number | (string | number)[];
}

interface VideoOptions extends object {}
