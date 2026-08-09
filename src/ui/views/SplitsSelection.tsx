import React, { useState, useEffect } from "react";
import {
    getSplitsInfos,
    type SplitsInfo,
    deleteSplits as storageDeleteSplits,
    copySplits as storageCopySplits,
    loadSplits,
    storeRunWithoutDisposing,
    storeSplitsKey,
} from "../../storage";
import { type Language, Run, RunEditor, Segment, TimerPhase } from "../../livesplit-core";
import { toast } from "react-toastify";
import {
    openFileAsArrayBuffer,
    exportFile,
    FILE_EXT_SPLITS,
} from "../../util/FileUtil";
import { type Option, bug, expect, maybeDisposeAndThen } from "../../util/OptionUtil";
import { type GeneralSettings } from "./MainSettings";
import { type LSOCommandSink } from "../../util/LSOCommandSink";
import { showDialog } from "../components/Dialog";
import { Label, resolve, orAutoLang } from "../../localization";
import {
    ArrowLeft,
    Circle,
    Copy,
    Download,
    FolderOpen,
    Plus,
    Save,
    SquarePen,
    Trash,
    Upload,
} from "lucide-react";

import classes from "../../css/SplitsSelection.module.css";
import sidebarClasses from "../../css/Sidebar.module.css";
import { TextBox } from "../components/TextBox";

export interface EditingInfo {
    splitsKey?: number;
    run: Run;
}

export interface Props {
    commandSink: LSOCommandSink;
    openedSplitsKey: number | undefined;
    callbacks: Callbacks;
    generalSettings: GeneralSettings;
    splitsModified: boolean;
}

interface Callbacks {
    openRunEditor(editingInfo: EditingInfo): void;
    setSplitsKey(newKey?: number): void;
    openTimerView(): void;
    renderViewWithSidebar(
        renderedView: React.JSX.Element,
        sidebarContent: React.JSX.Element,
    ): React.JSX.Element;
    saveSplits(): Promise<void>;
    setRunData(run: Run): void;
}

export function SplitsSelection(props: Props) {
    const lang = props.generalSettings.lang;
    const [splitsInfos, setSplitsInfos] = useState<
        Array<[number, SplitsInfo]> | undefined
    >();
    const [offsetState, setOffsetState] = useState("0");
    useEffect(() => {
        async function fetchSplitsInfos() {
            const splitsInfos = await getSplitsInfos();
            setSplitsInfos(splitsInfos);
        }
        fetchSplitsInfos();
    }, []);

    const refreshDb = async () => {
        const splitsInfos = await getSplitsInfos();
        setSplitsInfos(splitsInfos);
    };

    const saveSplits = async () => {
        await props.callbacks.saveSplits();
        refreshDb();
    };

    const exportTimerSplits = () => {
        props.commandSink.markAsUnmodified();
        const name = props.commandSink.extendedFileName(true);
        const lss = props.commandSink.saveAsLssBytes();
        try {
            exportFile(name + ".lss", lss);
        } catch (_) {
            toast.error(resolve(Label.FailedToExportSplits, lang));
        }
    };

    const openTimerView = () => {
        props.callbacks.openTimerView();
    };

    return props.callbacks.renderViewWithSidebar(
        <View
            {...props}
            splitsInfos={splitsInfos}
            offsetState={offsetState}
            setOffsetState={setOffsetState}
            refreshDb={refreshDb}
            lang={lang}
        />,
        <SideBar
            commandSink={props.commandSink}
            callbacks={props.callbacks}
            splitsModified={props.splitsModified}
            saveSplits={saveSplits}
            exportTimerSplits={exportTimerSplits}
            openTimerView={openTimerView}
            lang={lang}
        />,
    );
}

function View({
    commandSink,
    openedSplitsKey,
    callbacks,
    splitsInfos,
    offsetState,
    setOffsetState,
    refreshDb,
    lang,
}: {
    commandSink: LSOCommandSink;
    openedSplitsKey: number | undefined;
    callbacks: Callbacks;
    splitsInfos: Array<[number, SplitsInfo]> | undefined;
    offsetState: string;
    setOffsetState: (newOffset: string) => void;
    refreshDb: () => Promise<void>;
    lang: Language | undefined;
}) {
    const addNewSplits = async (offset: string, lang: Language) => {
        console.log("Adding new splits with offset:", offset);
        setOffsetState(offset);
        const run = Run.new();
        run.pushSegment(Segment.new(resolve(Label.NewSegmentName, lang)));

        const editor = expect(
            RunEditor.new(run),
            "The Run Editor should always be able to be opened.",
            lang,
        );
        editor.parseAndSetOffset(offset, lang);
        editor.close();

        callbacks.setRunData(run);
    };

    return (
        <TextBox
            value={offsetState}
            onChange={(e) => addNewSplits(e.target.value, orAutoLang(lang))}
            onBlur={(_) => {}}
            invalid={false}
            label={resolve(Label.StartTimerAt, lang)}
        />
    );
}

function SavedSplitsRow({
    openedSplitsKey,
    splitsKey,
    info,
    openSplits,
    editSplits,
    exportSplits,
    copySplits,
    deleteSplits,
    lang,
}: {
    openedSplitsKey: number | undefined;
    splitsKey: number;
    info: SplitsInfo;
    openSplits: (key: number) => void;
    editSplits: (key: number) => void;
    exportSplits: (key: number, info: SplitsInfo) => void;
    copySplits: (key: number) => void;
    deleteSplits: (key: number) => void;
    lang: Language | undefined;
}) {
    const isOpened = splitsKey === openedSplitsKey;
    const classNames = [classes.splitsRow];
    if (isOpened) {
        classNames.push(classes.selected);
    }

    return (
        <div className={classNames.join(" ")} key={splitsKey}>
            <SplitsTitle
                game={info.game}
                category={info.category}
                lang={lang}
            />
            <div className={classes.splitsRowButtons}>
                {isOpened ? null : (
                    <>
                        <button
                            aria-label={resolve(Label.OpenSplits, lang)}
                            onClick={() => openSplits(splitsKey)}
                        >
                            <FolderOpen strokeWidth={2.5} />
                        </button>
                        <button
                            aria-label={resolve(Label.EditSplits, lang)}
                            onClick={() => editSplits(splitsKey)}
                        >
                            <SquarePen strokeWidth={2.5} />
                        </button>
                        <button
                            aria-label={resolve(Label.ExportSplits, lang)}
                            onClick={() => exportSplits(splitsKey, info)}
                        >
                            <Upload strokeWidth={2.5} />
                        </button>
                    </>
                )}
                <button
                    aria-label={resolve(Label.CopySplits, lang)}
                    onClick={() => copySplits(splitsKey)}
                >
                    <Copy strokeWidth={2.5} />
                </button>
                <button
                    aria-label={resolve(Label.RemoveSplits, lang)}
                    onClick={() => deleteSplits(splitsKey)}
                >
                    <Trash strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
}

function SplitsTitle({
    game,
    category,
    lang,
}: {
    game: string;
    category: string;
    lang: Language | undefined;
}) {
    return (
        <div className={classes.splitsTitleText}>
            <div className={`${classes.splitsText} ${classes.splitsGame}`}>
                {game || resolve(Label.Untitled, lang)}
            </div>
            <div className={classes.splitsText}>
                {category || resolve(Label.NoCategory, lang)}
            </div>
        </div>
    );
}

function SideBar({
    commandSink,
    callbacks,
    splitsModified,
    saveSplits,
    exportTimerSplits,
    openTimerView,
    lang,
}: {
    commandSink: LSOCommandSink;
    callbacks: any;
    splitsModified: boolean;
    saveSplits: () => void;
    exportTimerSplits: () => void;
    openTimerView: () => void;
    lang: Language | undefined;
}) {
    return (
        <>
            <h1>{resolve(Label.Splits, lang)}</h1>
            <hr />
            <button
                onClick={(_) => {
                    if (commandSink.currentPhase() !== TimerPhase.NotRunning) {
                        toast.error(resolve(Label.EditWhileRunningError, lang));
                        return;
                    }
                    const run = commandSink.getRun().clone();
                    callbacks.openRunEditor({ run });
                }}
            >
                <SquarePen strokeWidth={2.5} />
                {resolve(Label.Edit, lang)}
            </button>
            <button onClick={saveSplits}>
                <Save strokeWidth={2.5} />
                <span>
                    {resolve(Label.Save, lang)}
                    {splitsModified && (
                        <Circle
                            strokeWidth={0}
                            size={12}
                            fill="currentColor"
                            className={sidebarClasses.modifiedIcon}
                        />
                    )}
                </span>
            </button>
            <button onClick={exportTimerSplits}>
                <Upload strokeWidth={2.5} />
                {resolve(Label.Export, lang)}
            </button>
            <hr />
            <button onClick={openTimerView}>
                <ArrowLeft strokeWidth={2.5} />
                {resolve(Label.Back, lang)}
            </button>
        </>
    );
}
