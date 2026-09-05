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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";

import { VERDICT_SETS, DEFAULT_VERDICT_SET } from "../constants.js";

// Cases kept ready so the panel can be demonstrated without inventing one on
// the spot. The first is the case the course uses as its canonical example.
export const EXAMPLE_CASES = [
    {
        /*
         * Case T-001, from the course's case design dossier. This is the
         * canonical charge sheet for the running project, so it is reproduced
         * rather than paraphrased. The agreed factual record is the part that
         * makes the case arguable: each line is a fact both sides must work
         * with, rather than a conclusion either of them can simply assert.
         *
         * Its question asks whether an act was justified, not whether a person
         * was guilty, so the court answers in that vocabulary.
         */
        label: "T-001 \u00b7 Jon Snow",
        verdictSet: "JUSTIFICATION",
        defendant:
            "Jon Snow \u2014 Case T-001, The Realm v. Jon Snow. Deceased: Daenerys Targaryen.",
        act:
            "ACT ALLEGED\n" +
            "Jon intentionally killed Daenerys by stabbing her during a private " +
            "meeting in the throne room after the fall of King's Landing.\n\n" +
            "BASE PREMISES\n" +
            "The story takes place mainly in Westeros, a continent where powerful " +
            "families compete for the Iron Throne. Jon Snow grows up believing he " +
            "is the illegitimate son of Lord Eddard Stark. He becomes a military " +
            "commander, then King in the North. He later learns that he is the " +
            "lawful son of Rhaegar Targaryen and Lyanna Stark, which gives him a " +
            "stronger hereditary claim to the throne than Daenerys, although he " +
            "does not want to rule.\n\n" +
            "Daenerys Targaryen is the exiled heir of the dynasty that once ruled " +
            "Westeros. She survives abuse, gains three dragons, frees enslaved " +
            "people, and builds an army. Her victories make her both a liberator " +
            "and an increasingly absolute ruler. Jon and Daenerys become allies " +
            "and lovers while fighting the Night King, whose army threatens all " +
            "living people, and Jon pledges loyalty to her. After they defeat the " +
            "dead, Daenerys turns to the Iron Throne. Jon's hidden parentage then " +
            "weakens her political claim and feeds her fear of betrayal.\n\n" +
            "Daenerys attacks King's Landing, the capital held by Queen Cersei " +
            "Lannister. The city surrenders, but Daenerys burns streets and " +
            "civilians from her dragon, Drogon. Jon witnesses the destruction. " +
            "Grey Worm, her commander, joins the killing on the ground. " +
            "Afterward, Daenerys promises further campaigns of liberation. Tyrion " +
            "Lannister, her chief adviser, resigns in protest and is imprisoned. " +
            "He warns Jon that Daenerys will kill anyone who threatens her rule, " +
            "including Jon's sisters. Jon asks Daenerys to show mercy and share " +
            "moral judgment with others. She refuses. During an embrace, he stabs " +
            "her to death. Her soldiers arrest him.\n\n" +
            "AGREED FACTUAL RECORD\n" +
            "- King's Landing had surrendered: its bells rang and organized " +
            "resistance had ceased. Daenerys then used Drogon against streets and " +
            "civilians, causing destruction on a vast scale.\n" +
            "- After the victory, Daenerys told her assembled forces that the " +
            "campaign of liberation would continue beyond King's Landing. Jon had " +
            "seen the city and heard the speech.\n" +
            "- Tyrion Lannister renounced his office as Hand and was imprisoned. " +
            "He warned Jon that Daenerys would treat Jon's sisters, and anyone " +
            "else she regarded as an obstacle, as enemies.\n" +
            "- Jon asked Daenerys to forgive Tyrion and to show mercy. She refused " +
            "to let others choose what was good and presented her own judgment as " +
            "decisive.\n" +
            "- Daenerys was unarmed and was not attacking Jon when he killed her. " +
            "Jon used their intimacy to get close enough to strike. He had not " +
            "convened a council, attempted detention, or sought a public surrender " +
            "of power.",
        question:
            "Was Jon Snow's intentional killing of Daenerys Targaryen justified as " +
            "the necessary defense of others and of the realm, given what he knew, " +
            "the scale of the threatened harm, the absence or presence of safer " +
            "alternatives, and his lack of formal authority?"
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
                                            question: example.question,
                                            verdictSet: example.verdictSet || DEFAULT_VERDICT_SET
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
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            The court answers in these words
                        </Typography>
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={sheet.verdictSet || DEFAULT_VERDICT_SET}
                            onChange={function (event, value) {
                                if (value) {
                                    props.onChange(Object.assign({}, sheet, { verdictSet: value }));
                                }
                            }}
                            disabled={props.disabled}
                        >
                            {Object.keys(VERDICT_SETS).map(function (key) {
                                const pair = VERDICT_SETS[key];
                                return (
                                    <ToggleButton key={key} value={key} sx={{ textTransform: "none" }}>
                                        {pair.positive.toLowerCase()} / {pair.negative.toLowerCase()}
                                    </ToggleButton>
                                );
                            })}
                        </ToggleButtonGroup>
                    </Box>

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
