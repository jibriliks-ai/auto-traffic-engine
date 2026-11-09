import { Composition, registerRoot } from "remotion";
import { VideoTemplate } from "./VideoTemplate";

const RemotionRoot = () => {
  return (
    <Composition
      id="VideoTemplate"
      component={VideoTemplate as any}
      durationInFrames={600}
      fps={30}
      width={720}
      height={1280}
      defaultProps={{
        productImageUrl: "",
        productName: "",
        hookText: "",
        benefits: [] as string[],
        priceText: "",
        originalPriceText: "",
        ctaText: "",
        brandColor: "#4f46e5",
        qrCodeUrl: "",
      }}
    />
  );
};

registerRoot(RemotionRoot);

