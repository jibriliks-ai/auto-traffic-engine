import {
  AbsoluteFill,
  Sequence,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface VideoTemplateProps {
  productImageUrl: string;
  productName: string;
  hookText: string;
  benefits: string[];
  priceText: string;
  originalPriceText: string;
  ctaText: string;
  brandColor: string;
  qrCodeUrl: string;
}

export function VideoTemplate(props: VideoTemplateProps) {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: props.brandColor }}>
      <Sequence from={0} durationInFrames={2 * fps}>
        <HookScene {...props} />
      </Sequence>
      <Sequence from={2 * fps} durationInFrames={4 * fps}>
        <ProblemScene {...props} />
      </Sequence>
      <Sequence from={6 * fps} durationInFrames={3 * fps}>
        <SolutionScene {...props} />
      </Sequence>
      <Sequence from={9 * fps} durationInFrames={1 * fps}>
        <CTAScene {...props} />
      </Sequence>
    </AbsoluteFill>
  );
}

function HookScene({
  hookText,
  productImageUrl,
  brandColor,
}: VideoTemplateProps) {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, 8], [0.7, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Img
        src={productImageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.4,
        }}
      />
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.55)" }} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 30px",
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            fontSize: 41,
            fontWeight: 900,
            color: "white",
            textAlign: "center",
            lineHeight: 1.05,
            textShadow: "0 2px 12px rgba(0,0,0,0.9)",
            fontFamily: "Arial, sans-serif",
            letterSpacing: -0.5,
          }}
        >
          {hookText}
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: brandColor,
        }}
      />
    </AbsoluteFill>
  );
}

function ProblemScene({
  productImageUrl,
  productName,
}: VideoTemplateProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Img
        src={productImageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          padding: "0 25px 100px",
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            color: "white",
            textShadow: "0 2px 12px rgba(0,0,0,0.9)",
            fontFamily: "Arial, sans-serif",
            lineHeight: 1.1,
          }}
        >
          {productName}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function SolutionScene({
  productImageUrl,
  benefits,
  priceText,
  originalPriceText,
  brandColor,
}: VideoTemplateProps) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Img
        src={productImageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: "#0a0a0a",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          padding: "0 25px 140px",
        }}
      >
        {benefits.slice(0, 3).map((benefit, i) => {
          const delay = i * 12;
          const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const translateY = interpolate(frame - delay, [0, 15], [10, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 9,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: brandColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "white",
                  fontWeight: 900,
                }}
              >
                ✓
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "white",
                  textShadow: "0 1px 6px rgba(0,0,0,0.9)",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {benefit}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          bottom: 90,
          left: 25,
          right: 25,
          backgroundColor: brandColor,
          borderRadius: 12,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: "white",
            fontFamily: "Arial, sans-serif",
          }}
        >
          {priceText}
        </div>
        {originalPriceText && (
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              textDecoration: "line-through",
              fontFamily: "Arial, sans-serif",
            }}
          >
            {originalPriceText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

function CTAScene({ qrCodeUrl, ctaText, brandColor }: VideoTemplateProps) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandColor,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 40px",
      }}
    >
      <Img
        src={qrCodeUrl}
        style={{
          width: 200,
          height: 200,
          backgroundColor: "white",
          borderRadius: 12,
          padding: 10,
          marginBottom: 30,
        }}
      />
      <div
        style={{
          fontSize: 34,
          fontWeight: 900,
          color: "white",
          textAlign: "center",
          fontFamily: "Arial, sans-serif",
          lineHeight: 1.1,
        }}
      >
        {ctaText}
      </div>
    </AbsoluteFill>
  );
}