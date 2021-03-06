///<reference path='refs.ts'/>

module TDev
{
    export class ActionProperties
        extends SideTab
    {
        private theAction:AST.ActionHeader;
        private lastName = "";
        private asAction: boolean;
        
        constructor() {
            super()
        }

        private actionName = HTML.mkTextInputWithOk("text", lf("function name"),() => {
            this.updateActionName();
            this.theAction.notifyChange();
            TheEditor.refreshDecl();
        });
        private privateAction = HTML.mkTickCheckBox(Ticks.actionPropPrivate, lf("private function"));
        private testAction = HTML.mkTickCheckBox(Ticks.actionPropTest, lf("test function"));
        private queryAction = HTML.mkTickCheckBox(Ticks.actionPropTest, lf("read only"));
        private offlineAction = HTML.mkTickCheckBox(Ticks.actionPropTest, lf("offline available"));
        private syncBox:HTMLElement;
        private inParms = div("paramList", []);
        private outParms = div("paramList", []);
        public getTick() { return Ticks.sideActionHeaderInit; }

        public init(e:Editor)
        {
            super.init(e);
            this.actionName.id = "renameBox";

            this.syncBox = HTML.mkTickCheckBox(Ticks.actionPropAtomic, lf("'atomic' function"), (v) => {
                this.theAction.action.isAtomic = v;
                this.theAction.notifyChange();
                e.updateTutorial();
            });

            this.testAction.appendChild(Editor.mkHelpLink("testing"));
            this.syncBox.appendChild(Editor.mkHelpLink("async actions"));
        }

        public editedStmt():AST.Stmt { return this.theAction; }

        private isActive() { return !!this.theAction; }

        private updateActionName()
        {
            if (!this.theAction) return;
            var nam = TheEditor.tutorializeName(this.actionName.value);
            if (nam == this.lastName) return;
            this.lastName = nam;
            if (this.theAction.getName() == this.lastName) return;

            var name = Script.freshName(this.lastName);
            this.theAction.action.setName(name);

            if (this.theAction.action.modelParameter) {
                var mk = <AST.RecordEntryKind> this.theAction.action.modelParameter.local.getKind();
                var df = mk.record;
                if (df) {
                    df.setName(Script.freshName(this.theAction.getName() + " page data"))
                }
            }
        }

        private mkParam(kind:string, lbl:string, t:Ticks)
        {
            var e = new DeclEntry(lbl)
            e.makeIntoAddButton();
            e.description = lf("create a new parameter");
            var ee = e.mkBox();
            HTML.setTickCallback(ee, t, () => {
                var blk = this.theAction.inParameters;
                if (kind == "output")
                    blk = this.theAction.outParameters;
                var empt = blk.emptyStmt()
                TheEditor.initIds(empt, true)
                var newCh = blk.stmts.concat([empt]);
                blk.setChildren(newCh);
                this.updateActionName();
                this.theAction.notifyChange();
                TheEditor.refreshDecl();

                // Jump directly into the parameter definition and edit its name.
                TheEditor.editNode(empt);
                TheEditor.calculator.inlineEdit(TheEditor.calculator.expr.tokens[0]);
            });
            return ee;
        }

        private syncParms()
        {
            this.actionName.value = this.theAction.getName();
            HTML.setCheckboxValue(this.privateAction, this.theAction.action.isPrivate);
            HTML.setCheckboxValue(this.testAction, this.theAction.action.isTest());
            HTML.setCheckboxValue(this.queryAction, this.theAction.action.isQuery);
            HTML.setCheckboxValue(this.offlineAction, this.theAction.action.isOffline);
            HTML.setCheckboxValue(this.syncBox, this.theAction.action.isAtomic)
        }

        static functionBox(labl:string, key:string, t:Ticks, f:()=>void)
        {
            var b = HTML.mkButton(labl, () => { tick(t); f() });
            KeyboardMgr.instance.btnShortcut(b, key)
            return b;
            /*
            var e = new DeclEntry(labl);
            e.icon = icon;
            e.description = desc;
            return e.mkBox().withClick(f);
            */
        }

        static copyCutRefs(kind:string, decl:AST.Decl)
        {
            var cp =  !TheEditor.isDebuggerMode() && TheEditor.widgetEnabled("copyPaste");
            return div(null,
              cp ? ActionProperties.functionBox(lf("cut"), "Ctrl-X, Shift-Del", Ticks.sideCut, () => TheEditor.cutDecl(decl)) : undefined,
              cp ? ActionProperties.functionBox(lf("copy"), "Ctrl-C, Ctrl-Ins", Ticks.sideCopy, () => TheEditor.copyDecl(decl)) : undefined,
              ActionProperties.functionBox(lf("delete"), "Del", Ticks.sideDelete, () => TheEditor.cutDecl(decl, true)),
              TheEditor.widgetEnabled("findReferences") ? ActionProperties.functionBox(lf("find references"), "Ctrl-G", Ticks.sideFindRefs, () => TheEditor.findRefs(decl)) : undefined,
              dbg ? ActionProperties.functionBox(lf("see text (dbg)"), "", Ticks.noEvent, () => ModalDialog.showText(decl.serialize())) : undefined
            );
        }

        public edit(aa:AST.Stmt)
        {
            var a = <AST.ActionHeader> aa;
            this.theAction = a;
            this.lastName = "";
            TheEditor.refreshDecl();

            this.syncParms();
            var ev = this.theAction.action.isEvent();
            var tp = this.theAction.action.isActionTypeDef();
            var pa = this.theAction.action.parent;
            var icl = pa !== undefined && pa.isCloud;
            this.actionName.readOnly = ev;
            var act = this.theAction.action;
            var showSettings = TheEditor.widgetEnabled("actionSettings");
            var showAtomic = showSettings && TheEditor.widgetEnabled("scriptPropertiesPropertyAtomic");
            this.asAction = this.theAction.getName() == "main" && TheEditor.widgetEnabled("forceMainAsAction");
            var singleReturnValue = TheEditor.widgetEnabled("singleReturnValue");
            if (this.asAction && !Script.isLibrary && !Script.isDocsTopic()) {
                this.actionName.readOnly = true;
                this.theAction.action.isPrivate = false;
            }
            var propDivs =
                 [div("prop-spacer"),
                  div(null, span("varLabel", lf("function"))),
                  this.actionName,
                  !showSettings || ev || this.asAction ? null : this.privateAction,
                  !showSettings || ev ? null : div("formHint",
                    Script.isLibrary ? lf("Private functions cannot be called from outside the library. ") : lf("Private actions do not get a run button. ")),
                  !showAtomic || a.action.isPage() || ev || !asyncEnabled ? null : this.syncBox,
                  ev || this.asAction ? null : this.mkParam("input", lf("add input parameter"), Ticks.sideActionAddInput),
                  ev || act.isPage() || this.asAction || (singleReturnValue && this.theAction.outParameters.count() > 0) ? null : this.mkParam("output", lf("add output parameter"), Ticks.sideActionAddOutput),
                  ActionProperties.copyCutRefs(lf("the current function"), this.theAction.action),

                  !TheEditor.widgetEnabled("testAction") || ev || tp ? null : this.testAction,
                  showSettings && icl ? this.offlineAction : null,
                  showSettings && icl ? this.queryAction : null,
                  Browser.EditorSettings.changeSkillLevelDiv(this.editor, Ticks.changeSkillActionProperties, "formHint marginBottom"),
                  ];
            this.setChildren(propDivs);
        }

        public bye()
        {
            if (!this.theAction) return;
            this.theAction.action.isPrivate = HTML.getCheckboxValue(this.privateAction) && !this.asAction;
            this.theAction.action._isTest = HTML.getCheckboxValue(this.testAction);
            this.theAction.action.isOffline = HTML.getCheckboxValue(this.offlineAction);
            this.theAction.action.isQuery = HTML.getCheckboxValue(this.queryAction);
            this.theAction.action.isAtomic = HTML.getCheckboxValue(this.syncBox);
            this.updateActionName();
            this.theAction.notifyChange();
            this.theAction = null;
            TheEditor.refreshDecl();
            TheEditor.queueNavRefresh();
        }
    }
}
