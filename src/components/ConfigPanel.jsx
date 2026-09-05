/*
 * ConfigPanel.jsx - the two arrangements, the models, and the budget.
 *
 * The whole comparison the project is asked to make lives on this panel:
 * arrangement A gives one model all seven calls and lets the system prompts do
 * the work, arrangement B splits the panel so the speakers and the judges run
 * on different models. The estimate shown next to the cap is the worst case,
 * not the likely case, because a cap that binds on the likely case does not
 * bind at all.
 */

import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import {
    CONFIG_SINGLE,
    CONFIG_SPLIT,
    CONFIG_LABELS,
    MAX_BUDGET_USD,
    CALLS_PER_RUN
} from "../constants.js";
import { formatUsd, formatDuration } from "../lib/money.js";
import { pingModel } from "../tribunal/client.js";

// One row of the model list: the name, then what it costs per million tokens,
// which is the unit the prices are actually readable in.
function ModelOption(props) {
    const model = props.model;
    const perMillionIn = model.promptPrice * 1000000;
    const perMillionOut = model.completionPrice * 1000000;
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
            <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                {model.name}
            </Typography>
            {model.isFree ? (
                <Chip label="free" size="small" color="success" variant="outlined" />
            ) : (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    ${perMillionIn.toFixed(2)} in / ${perMillionOut.toFixed(2)} out per 1M
                </Typography>
            )}
        </Box>
    );
}

function ModelPicker(props) {
    return (
        <Autocomplete
            options={props.models}
            value={props.value}
            onChange={function (event, value) {
                if (value) {
                    props.onChange(value);
                }
            }}
            disabled={props.disabled}
            getOptionLabel={function (model) {
                return model ? model.name : "";
            }}
            isOptionEqualToValue={function (a, b) {
                return a.id === b.id;
            }}
            groupBy={function (model) {
                return model.isFree ? "Free" : "Paid";
            }}
            renderOption={function (optionProps, model) {
                return (
                    <li {...optionProps} key={model.id}>
                        <ModelOption model={model} />
                    </li>
                );
            }}
            renderInput={function (params) {
                return <TextField {...params} label={props.label} size="small" />;
            }}
            sx={{ minWidth: 260, flexGrow: 1 }}
        />
    );
}

/*
 * Tries the chosen models with one eight-token call each.
 *
 * Roughly half the free models on OpenRouter refuse or rate-limit at any given
 * moment. Discovering that through a failed deliberation costs four speeches
 * and leaves empty seats on the bench; discovering it here costs nothing and
 * takes a second.
 */
function ModelTester(props) {
    const [state, setState] = React.useState(null);
    const [busy, setBusy] = React.useState(false);

    const targets = React.useMemo(
        function () {
            const list = [];
            if (props.speakerModel) {
                list.push({ label: props.splitConfig ? "Speakers" : "All seven", model: props.speakerModel });
            }
            if (props.splitConfig && props.judgeModel && props.judgeModel.id !== (props.speakerModel || {}).id) {
                list.push({ label: "Judges", model: props.judgeModel });
            }
            return list;
        },
        [props.speakerModel, props.judgeModel, props.splitConfig]
    );

    async function test() {
        setBusy(true);
        setState(null);
        const results = [];
        for (let index = 0; index < targets.length; index += 1) {
            const target = targets[index];
            const outcome = await pingModel(target.model.id);
            results.push({ label: target.label, id: target.model.id, ...outcome });
        }
        setState(results);
        setBusy(false);
    }

    if (targets.length === 0) {
        return null;
    }

    return (
        <Box sx={{ mt: 2 }}>
            <Button size="small" variant="outlined" onClick={test} disabled={busy || props.disabled}>
                {busy ? "Testing…" : "Test these models"}
            </Button>
            {state ? (
                <Stack gap={0.5} sx={{ mt: 1.5 }}>
                    {state.map(function (result) {
                        return (
                            <Alert
                                key={result.id}
                                severity={result.ok ? "success" : "error"}
                                icon={false}
                                sx={{ py: 0.25 }}
                            >
                                <Typography variant="body2">
                                    <strong>{result.label}</strong> · {result.id} —{" "}
                                    {result.ok
                                        ? "answered in " + formatDuration(result.elapsedMs)
                                        : result.error}
                                </Typography>
                            </Alert>
                        );
                    })}
                </Stack>
            ) : null}
        </Box>
    );
}

export default function ConfigPanel(props) {
    const isSplit = props.config === CONFIG_SPLIT;
    const estimate = props.estimate;
    const overBudget = estimate && estimate.worstCaseUsd > props.budgetUsd;

    return (
        <Card variant="outlined">
            <CardContent>
                <Typography variant="h6">The arrangement</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Seven calls either way. What changes is how many models produce them.
                </Typography>

                <RadioGroup
                    value={props.config}
                    onChange={function (event) {
                        props.onConfigChange(event.target.value);
                    }}
                >
                    <FormControlLabel
                        value={CONFIG_SINGLE}
                        control={<Radio size="small" />}
                        disabled={props.disabled}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight={600}>
                                    {CONFIG_LABELS.SINGLE}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Seven voices out of one model. Only the system prompts differ,
                                    so the panel shares whatever blind spot that model brought.
                                </Typography>
                            </Box>
                        }
                    />
                    <FormControlLabel
                        value={CONFIG_SPLIT}
                        control={<Radio size="small" />}
                        disabled={props.disabled}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight={600}>
                                    {CONFIG_LABELS.SPLIT}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    One model argues, a different one rules. The judges no longer
                                    share the speakers' habits of reasoning.
                                </Typography>
                            </Box>
                        }
                    />
                </RadioGroup>

                <Divider sx={{ my: 2 }} />

                <Stack direction={{ xs: "column", md: "row" }} gap={2}>
                    <ModelPicker
                        label={isSplit ? "Model for the four speakers" : "Model for all seven calls"}
                        models={props.models}
                        value={props.speakerModel}
                        onChange={props.onSpeakerModelChange}
                        disabled={props.disabled}
                    />
                    {isSplit ? (
                        <ModelPicker
                            label="Model for the three judges"
                            models={props.models}
                            value={props.judgeModel}
                            onChange={props.onJudgeModelChange}
                            disabled={props.disabled}
                        />
                    ) : null}
                </Stack>

                {props.catalogueError ? (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        The live model list could not be read ({props.catalogueError}), so the
                        pickers are showing a short built-in list of free models instead.
                    </Alert>
                ) : null}

                <ModelTester
                    speakerModel={props.speakerModel}
                    judgeModel={props.judgeModel}
                    splitConfig={isSplit}
                    disabled={props.disabled}
                />

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                    Budget for one run
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    The run is refused before the first call if its worst case exceeds this.
                    The brief allows five dollars; free models keep it at nothing.
                </Typography>
                <Box sx={{ px: 1, mt: 1 }}>
                    <Slider
                        value={props.budgetUsd}
                        min={0.05}
                        max={MAX_BUDGET_USD}
                        step={0.05}
                        marks={[
                            { value: 0.05, label: "$0.05" },
                            { value: 1, label: "$1" },
                            { value: MAX_BUDGET_USD, label: "$5" }
                        ]}
                        valueLabelDisplay="auto"
                        valueLabelFormat={function (value) {
                            return "$" + value.toFixed(2);
                        }}
                        onChange={function (event, value) {
                            props.onBudgetChange(value);
                        }}
                        disabled={props.disabled}
                    />
                </Box>

                {estimate ? (
                    <Alert severity={overBudget ? "error" : "success"} sx={{ mt: 1 }}>
                        <Typography variant="body2">
                            <strong>{CALLS_PER_RUN} calls.</strong> Worst case{" "}
                            <strong>{formatUsd(estimate.worstCaseUsd)}</strong> against a cap of{" "}
                            <strong>{formatUsd(props.budgetUsd)}</strong>.
                            {overBudget
                                ? " This run will be refused. Choose cheaper models or raise the cap."
                                : estimate.worstCaseUsd === 0
                                  ? " Every call is on a free model, so this run costs nothing."
                                  : " The real charge is normally well under the worst case."}
                        </Typography>
                    </Alert>
                ) : null}
            </CardContent>
        </Card>
    );
}
