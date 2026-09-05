/*
 * ArrangementDiagram.jsx - what the chosen arrangement actually looks like.
 *
 * Two radio buttons cannot show the difference between the two arrangements,
 * because the difference is structural: in one, all seven calls run through a
 * single model and the bench inherits whatever that model is blind to; in the
 * other, the judges sit on a model the advocates never touched. Drawing the
 * wiring makes that visible at a glance, and the card merging or splitting as
 * you switch is the point being made.
 */

import React from "react";
import { keyframes } from "@emotion/react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GavelIcon from "@mui/icons-material/Gavel";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";

import { CONFIG_SINGLE } from "../constants.js";
import { SIDE_COLORS } from "../theme.js";

// A pulse travelling down the wire, in the direction the work flows.
const flow = keyframes`
  0%   { left: -6px;  opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { left: 100%;  opacity: 0; }
`;

const appear = keyframes`
  from { opacity: 0; transform: translateY(-8px) scale(.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
`;

const REDUCED = "@media (prefers-reduced-motion: reduce)";

function Dots(props) {
    return (
        <Stack direction="row" gap={0.5} alignItems="center">
            {Array.from({ length: props.count }).map(function (ignored, index) {
                return (
                    <Box
                        key={index}
                        sx={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            border: "1.5px solid",
                            borderColor: props.color,
                            color: props.color,
                            backgroundColor: "background.paper"
                        }}
                    >
                        {props.icon}
                    </Box>
                );
            })}
        </Stack>
    );
}

function Wire(props) {
    return (
        <Box
            sx={{
                position: "relative",
                flexGrow: 1,
                minWidth: 28,
                height: 2,
                borderRadius: 1,
                backgroundColor: props.color,
                opacity: 0.35,
                overflow: "visible"
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    top: -2,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: props.color,
                    animation: `${flow} 2.4s linear ${props.delay || 0}s infinite`,
                    [REDUCED]: { animation: "none", display: "none" }
                }}
            />
        </Box>
    );
}

function ModelCard(props) {
    const model = props.model;
    if (!model) {
        return null;
    }
    return (
        <Box
            sx={{
                minWidth: { xs: 0, sm: 190 },
                maxWidth: 240,
                px: 1.5,
                py: 1.25,
                borderRadius: 1,
                border: "1.5px solid",
                borderColor: props.accent,
                backgroundColor: "background.paper",
                animation: `${appear} .4s cubic-bezier(.2,1.3,.4,1) 1`,
                [REDUCED]: { animation: "none" }
            }}
        >
            <Typography variant="caption" sx={{ color: props.accent, fontWeight: 700, fontSize: 10 }}>
                {props.label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, mt: 0.25 }} noWrap>
                {model.name}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
                <Chip
                    size="small"
                    variant="outlined"
                    color={model.isFree ? "success" : "default"}
                    label={model.isFree ? "free" : "paid"}
                    sx={{ height: 18, fontSize: 10 }}
                />
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 10 }}>
                    {props.calls} call{props.calls === 1 ? "" : "s"}
                </Typography>
            </Stack>
        </Box>
    );
}

export default function ArrangementDiagram(props) {
    const single = props.config === CONFIG_SINGLE;
    const speakerModel = props.speakerModel;
    const judgeModel = single ? props.speakerModel : props.judgeModel;
    const sameModel = single || (speakerModel && judgeModel && speakerModel.id === judgeModel.id);

    if (!speakerModel) {
        return null;
    }

    return (
        <Box
            sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 1,
                border: "1px dashed",
                borderColor: "divider",
                backgroundColor: "action.hover"
            }}
        >
            <Stack direction={{ xs: "column", sm: "row" }} alignItems="stretch" gap={1.5}>
                {/* the seven agents, grouped by what they do */}
                <Stack gap={1.5} justifyContent="space-around" sx={{ flexShrink: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                        <Dots
                            count={4}
                            color={SIDE_COLORS.Prosecution}
                            icon={<RecordVoiceOverIcon sx={{ fontSize: 14 }} />}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                            4 advocates
                        </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={1}>
                        <Dots count={3} color="#a37b2c" icon={<GavelIcon sx={{ fontSize: 14 }} />} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                            3 judges
                        </Typography>
                    </Stack>
                </Stack>

                {/* the wiring */}
                <Stack gap={1.5} justifyContent="space-around" sx={{ flexGrow: 1, minWidth: 40, py: 1.5 }}>
                    <Wire color={SIDE_COLORS.Prosecution} delay={0} />
                    <Wire color="#a37b2c" delay={1.2} />
                </Stack>

                {/* the model, or the two models */}
                <Stack gap={1} justifyContent="center" sx={{ flexShrink: 0 }}>
                    {sameModel ? (
                        <ModelCard
                            model={speakerModel}
                            label="ALL SEVEN CALLS"
                            accent="#1f2933"
                            calls={7}
                        />
                    ) : (
                        <React.Fragment>
                            <ModelCard
                                model={speakerModel}
                                label="THE ADVOCATES"
                                accent={SIDE_COLORS.Prosecution}
                                calls={4}
                            />
                            <ModelCard
                                model={judgeModel}
                                label="THE BENCH"
                                accent="#a37b2c"
                                calls={3}
                            />
                        </React.Fragment>
                    )}
                </Stack>
            </Stack>

            {(speakerModel.isRouter || (judgeModel && judgeModel.isRouter)) ? (
                <Typography
                    variant="caption"
                    sx={{ display: "block", mt: 1.5, lineHeight: 1.5, color: "error.main" }}
                >
                    A router was chosen, not a model. It forwards every call to whichever free
                    model is free at that moment, so these seven calls can reach seven different
                    models. Whatever this run shows, it is not a comparison between one model and
                    two — pick a named model to make the arrangement mean anything.
                </Typography>
            ) : null}

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1.5, lineHeight: 1.5 }}
            >
                {sameModel
                    ? "One model produces all seven voices, so the bench shares whatever blind spot that model brought. Three judges that agree by construction tell you nothing."
                    : "The judges sit on a model the advocates never touched, so where they disagree, the disagreement is a signal rather than an artefact of one model."}
            </Typography>
        </Box>
    );
}
