import {
  AbsoluteFill,
  Sequence,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
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

export const VideoTemplate: React.FC<VideoTemplateProps> = (props) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: props.brandColor }}>
      {/* Scene 1 — HOOK (0-3s) */}
      <Sequence from={0} durationInFrames={3 * fps}>
        <HookScene {...props} />
      </Sequence>

      {/* Scene 2 — PROBLEM (3-10s) */}
      <Sequence from={3 * fps} durationInFrames={7 * fps}>
        <ProblemScene {...props} />
      </Sequence>

      {/* Scene 3 — SOLUTION (10-16s) */}
      <Sequence from={10 * fps} durationInFrames={6 * fps}>
        <SolutionScene {...props} />
      </Sequence>

      {/* Scene 4 — CTA (16-20s) */}
      <Sequence from={16 * fps} durationInFrames={4 * fps}>
        <CTAScene {...props} />
      </Sequence>
    </AbsoluteFill>
  );
};

function HookScene({
  hookText,
  productImageUrl,
  brandColor,
}: VideoTemplateProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  return (
    <AbsoluteFill>
      <Img
        src={productImageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.55)" }} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 60px",
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            fontSize: 82,
            fontWeight: 900,
            color: "white",
            textAlign: "center",
            lineHeight: 1.05,
            textShadow: "0 4px 24px rgba(0,0,0,0.9)",
            fontFamily: "Arial, sans-serif",
            letterSpacing: -1,
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
          height: 12,
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
          padding: "0 50px 200px",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "white",
            textShadow: "0 4px 24px rgba(0,0,0,0.9)",
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
          padding: "0 50px 280px",
        }}
      >
        {benefits.slice(0, 3).map((benefit, i) => {
          const delay = i * 12;
          const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const translateY = interpolate(frame - delay, [0, 15], [20, 0], {
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
                gap: 20,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  backgroundColor: brandColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  color: "white",
                  fontWeight: 900,
                }}
              >
                ✓
              </div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  color: "white",
                  textShadow: "0 2px 12px rgba(0,0,0,0.9)",
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
          bottom: 180,
          left: 50,
          right: 50,
          backgroundColor: brandColor,
          borderRadius: 24,
          padding: "28px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 60,
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
              fontSize: 40,
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
        padding: "0 80px",
      }}
    >
      <Img
        src={qrCodeUrl}
        style={{
          width: 400,
          height: 400,
          backgroundColor: "white",
          borderRadius: 24,
          padding: 20,
          marginBottom: 60,
        }}
      />
      <div
        style={{
          fontSize: 68,
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