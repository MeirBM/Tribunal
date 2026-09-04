/*
 * RunProgress.jsx - the panel while it is working.
 *
 * A deliberation takes tens of seconds and costs money, so it is shown as
 * seven named calls in two waves rather than as a spinner. The two waves are
 * drawn separately because the shape is the point: the four speakers really do
 * run at once, and the judges really do have to wait for them.
 */

import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import { SPEAKERS, JUDGES } from "../tribunal/personas.js";
import { CALLS_PER_RUN } from "../constants.js";
import { formatDuration } from "../lib/money.js";

function AgentRow(props) {
    const call = props.call;
    let icon = <RadioButtonUncheckedIcon fontSize="small" sx={{ color: "text.disabled" }} />;
    if (props.running && !call) {
        icon = <CircularProgress size={16} />;
    } else if (call && call.ok) {
        icon = <CheckCircleIcon fontSize="small" color="success" />;
    } else if (call && !call.ok) {
        icon = <ErrorIcon fontSize="small" color="error" />;
    }

    return (
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ py: 0.5 }}>
            {icon}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                    {props.name}
                    <Typography component="span" variant="caption" color="text.secondary">
                        {" · " + props.title}
                    </Typography>
                </Typography>
                {call && !call.ok ? (
                    <Typography variant="caption" color="error">
                        {call.error}
                    </Typography>
                ) : null}
            </Box>
            {call && call.ok ? (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {call.totalTokens.toLocaleString("en-US")} tok · {formatDuration(call.elapsedMs)}
                </Typography>
            ) : null}
        </Stack>
    );
}

export default function RunProgress(props) {
    const calls = props.calls || [];
    const byId = {};
    calls.forEach(function (call) {
        byId[call.id] = call;
    });

    const done = calls.length;
    const stage = props.stage;

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="h6">The panel is sitting</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {done} of {CALLS_PER_RUN} calls
                    </Typography>
                </Stack>
                <LinearProgress
                    variant="determinate"
                    value={(done / CALLS_PER_RUN) * 100}
                    sx={{ mb: 2 }}
                />

                <Typography variant="overline" color="text.secondary">
                    Wave one — the four speeches, called together
                </Typography>
                <Box sx={{ mb: 2 }}>
                    {SPEAKERS.map(function (speaker) {
                        return (
                            <AgentRow
                                key={speaker.id}
                                name={speaker.name}
                                title={speaker.role + " · " + speaker.title}
                                call={byId[speaker.id]}
                                running={stage === "speeches"}
                            />
                        );
                    })}
                </Box>

                <Typography variant="overline" color="text.secondary">
                    Wave two — the three rulings, called together once the speeches are in
                </Typography>
                <Box>
                    {JUDGES.map(function (judge) {
                        return (
                            <AgentRow
                                key={judge.id}
                                name={judge.name}
                                title={judge.title}
                                call={byId[judge.id]}
                                running={stage === "verdicts"}
                            />
                        );
                    })}
                </Box>
            </CardContent>
        </Card>
    );
}
