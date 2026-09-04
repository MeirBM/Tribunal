/*
 * ChargeSheetForm.jsx - where a case enters the system.
 *
 * The sheet is three fields rather than one free-text box, because the three
 * things a panel actually needs are who is accused, what they are said to have
 * done, and the exact question the court is being asked. A single box makes it
 * far too easy to submit a case that never states its own question, and every
 * agent downstream then guesses at what it is deciding.
 */

import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

// Cases kept ready so the panel can be demonstrated without inventing one on
// the spot. The first is the case the course uses as its canonical example.
export const EXAMPLE_CASES = [
    {
        label: "Jon Snow",
        defendant: "Jon Snow, of the Night's Watch, later of House Stark",
        act:
            "After the sack of King's Landing, in which Daenerys Targaryen used " +
            "dragonfire against a city that had already surrendered and killed a " +
            "large number of civilians, Jon Snow met her privately in the throne " +
            "room. She stated her intention to continue liberating the world by " +
            "force and refused to accept that the killing had been wrong. During " +
            "the conversation Jon Snow embraced her and stabbed her through the " +
            "heart, killing her. He was her nephew, her lover, and had sworn her " +
            "his loyalty. No trial, no council and no authority had ordered or " +
            "sanctioned the killing, and no immediate attack was underway at the " +
            "moment he acted.",
        question:
            "Was Jon Snow's killing of Daenerys Targaryen justified, or was it murder?"
    },
    {
        label: "The whistleblower",
        defendant: "Ana Ruiz, senior data engineer at a health insurance company",
        act:
            "Ana Ruiz discovered that her employer's pricing model was using a " +
            "proxy variable that raised premiums for residents of two specific " +
            "postal districts, both of which are majority minority neighbourhoods. " +
            "She raised it internally twice over four months and was told the model " +
            "had passed legal review. She then copied 40,000 anonymised customer " +
            "records, along with the model's source code, and gave them to a " +
            "journalist. The story led to a regulatory investigation and the model " +
            "was withdrawn. Her employment contract and the jurisdiction's trade " +
            "secrets statute both plainly prohibit what she did, and the copied " +
            "records included fields that could, when combined, re-identify some " +
            "individuals.",
        question:
            "Is Ana Ruiz guilty of the unlawful disclosure of confidential company data?"
    },
    {
        label: "The autonomous vehicle",
        defendant: "Meridian Systems, manufacturer of an autonomous delivery vehicle",
        act:
            "A Meridian delivery vehicle operating without a safety driver struck " +
            "and seriously injured a cyclist who crossed against a signal at dusk. " +
            "Internal documents show the perception team had logged 31 prior " +
            "near-misses in low light involving cyclists, and had recommended " +
            "restricting night operation until a sensor upgrade shipped. Management " +
            "declined, citing a delivery commitment, and instead lowered the " +
            "vehicle's operating speed at night by four kilometres per hour. The " +
            "vehicle behaved exactly as designed and within every applicable " +
            "regulation at the time of the collision.",
        question:
            "Is Meridian Systems criminally liable for the injury to the cyclist?"
    }
];

// A sheet is only usable when all three parts are actually there. A thin sheet
// does not fail loudly; it produces four confident speeches about nothing.
export function validateChargeSheet(sheet) {
    const problems = [];
    if (!sheet.defendant || sheet.defendant.trim().length < 2) {
        problems.push("Name the defendant.");
    }
    if (!sheet.act || sheet.act.trim().length < 40) {
        problems.push(
            "Describe the act and the case details in at least a few sentences. " +
                "A thin description produces four confident speeches about nothing."
        );
    }
    if (!sheet.question || sheet.question.trim().length < 10) {
        problems.push(
            "State the exact question the court must answer. Without it, each " +
                "judge decides a slightly different case."
        );
    }
    return problems;
}

export default function ChargeSheetForm(props) {
    const sheet = props.chargeSheet;
    const problems = props.showProblems ? validateChargeSheet(sheet) : [];

    function update(field) {
        return function (event) {
            props.onChange(Object.assign({}, sheet, { [field]: event.target.value }));
        };
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    flexWrap="wrap"
                    gap={1}
                    sx={{ mb: 2 }}
                >
                    <Box>
                        <Typography variant="h6">The charge sheet</Typography>
                        <Typography variant="body2" color="text.secondary">
                            One decision, put as a precise question. All seven agents read
                            exactly this and nothing else.
                        </Typography>
                    </Box>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                        {EXAMPLE_CASES.map(function (example) {
                            return (
                                <Chip
                                    key={example.label}
                                    label={example.label}
                                    size="small"
                                    variant="outlined"
                                    onClick={function () {
                                        props.onChange({
                                            defendant: example.defendant,
                                            act: example.act,
                                            question: example.question
                                        });
                                    }}
                                />
                            );
                        })}
                    </Stack>
                </Stack>

                <Stack gap={2}>
                    <TextField
                        label="Defendant"
                        value={sheet.defendant}
                        onChange={update("defendant")}
                        fullWidth
                        size="small"
                        placeholder="Who stands accused"
                        disabled={props.disabled}
                    />
                    <TextField
                        label="The act, and the case details"
                        value={sheet.act}
                        onChange={update("act")}
                        fullWidth
                        multiline
                        minRows={7}
                        placeholder="What is alleged to have happened, and everything the court needs in order to weigh it"
                        disabled={props.disabled}
                        helperText={sheet.act.length + " characters"}
                    />
                    <TextField
                        label="The exact question before the court"
                        value={sheet.question}
                        onChange={update("question")}
                        fullWidth
                        size="small"
                        placeholder="The single question every judge must answer"
                        disabled={props.disabled}
                    />
                </Stack>

                {problems.length > 0 ? (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        <Stack component="ul" sx={{ m: 0, pl: 2 }}>
                            {problems.map(function (problem) {
                                return <li key={problem}>{problem}</li>;
                            })}
                        </Stack>
                    </Alert>
                ) : null}

                {props.onClear ? (
                    <Button size="small" sx={{ mt: 2 }} onClick={props.onClear} disabled={props.disabled}>
                        Clear the sheet
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    );
}
