import { useState, useEffect, useRef } from 'react';
import { 
  useGetCourseStructure, 
  useReplaceCourseStructure,
  getGetCourseStructureQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Trash2, ChevronDown, ChevronRight, GripVertical, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { 
  SubjectInput, ModuleInput, UnitInput, LessonInput, ActivityInput, AssessmentInput, SkillInput, CourseStructureInput 
} from '@workspace/api-client-react';

// --- Shared UUID Generator for local unique keys ---
const generateId = () => Math.random().toString(36).substring(2, 9);

// --- Editor Components ---

function generateEmptySubject(): SubjectInput & { _id: string } {
  return { _id: generateId(), title: '', description: '', position: 0, modules: [] };
}
function generateEmptyModule(): ModuleInput & { _id: string } {
  return { _id: generateId(), title: '', description: '', position: 0, units: [] };
}
function generateEmptyUnit(): UnitInput & { _id: string } {
  return { _id: generateId(), title: '', description: '', position: 0, lessons: [] };
}
function generateEmptyLesson(): LessonInput & { _id: string } {
  return { _id: generateId(), title: '', description: '', position: 0, activities: [], assessments: [] };
}
function generateEmptyActivity(): ActivityInput & { _id: string } {
  return { _id: generateId(), title: '', content: '', position: 0, instructionalMinutes: 30 };
}
function generateEmptyAssessment(): AssessmentInput & { _id: string } {
  return { _id: generateId(), title: '', instructions: '', position: 0, skills: [] };
}
function generateEmptySkill(): SkillInput & { _id: string } {
  return { _id: generateId(), title: '', description: '', position: 0 };
}

// Add ID tags to the retrieved data so React mapping is stable
function deepCloneWithIds(subjects: any[]): any[] {
  return subjects.map(sub => ({
    ...sub,
    _id: generateId(),
    modules: (sub.modules || []).map((mod: any) => ({
      ...mod,
      _id: generateId(),
      units: (mod.units || []).map((unit: any) => ({
        ...unit,
        _id: generateId(),
        lessons: (unit.lessons || []).map((lesson: any) => ({
          ...lesson,
          _id: generateId(),
          activities: (lesson.activities || []).map((act: any) => ({ ...act, _id: generateId() })),
          assessments: (lesson.assessments || []).map((ass: any) => ({
            ...ass,
            _id: generateId(),
            skills: (ass.skills || []).map((sk: any) => ({ ...sk, _id: generateId() }))
          }))
        }))
      }))
    }))
  }));
}

// Clean IDs before sending to server
function cleanIds(subjects: any[]): SubjectInput[] {
  return subjects.map(sub => {
    const { _id: sId, id: sId2, ...sRest } = sub;
    return {
      ...sRest,
      modules: sub.modules.map((mod: any) => {
        const { _id: mId, id: mId2, ...mRest } = mod;
        return {
          ...mRest,
          units: mod.units.map((unit: any) => {
            const { _id: uId, id: uId2, ...uRest } = unit;
            return {
              ...uRest,
              lessons: unit.lessons.map((lesson: any) => {
                const { _id: lId, id: lId2, ...lRest } = lesson;
                return {
                  ...lRest,
                  activities: lesson.activities.map((act: any) => {
                    const { _id: aId, id: aId2, ...aRest } = act;
                    return aRest;
                  }),
                  assessments: lesson.assessments.map((ass: any) => {
                    const { _id: asId, id: asId2, ...asRest } = ass;
                    return {
                      ...asRest,
                      skills: ass.skills.map((sk: any) => {
                        const { _id: skId, id: skId2, ...skRest } = sk;
                        return skRest;
                      })
                    };
                  })
                };
              })
            };
          })
        };
      })
    };
  });
}

function swapArrayItems(arr: any[], idx1: number, idx2: number) {
  const newArr = [...arr];
  const temp = newArr[idx1];
  newArr[idx1] = newArr[idx2];
  newArr[idx2] = temp;
  // Update positions based on index
  return newArr.map((item, i) => ({ ...item, position: i }));
}

// --- Node Wrapper Component ---
const EditorNode = ({ 
  title, subtitle, isOpen, onToggle, onRemove, onMoveUp, onMoveDown, isReadOnly, children, colorClass
}: any) => {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className={`border rounded-lg mb-3 bg-card overflow-hidden shadow-sm ${colorClass}`}>
      <div className="flex items-center px-4 py-3 bg-muted/20 border-b group">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mr-2 -ml-2 p-0">
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </CollapsibleTrigger>
        <div className="flex-1 min-w-0 mr-4 cursor-pointer" onClick={onToggle}>
          <div className="font-semibold text-sm truncate">{title || <span className="italic text-muted-foreground">Untitled</span>}</div>
          <div className="text-xs text-muted-foreground uppercase font-mono tracking-wider">{subtitle}</div>
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onMoveUp && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onMoveUp}>
                <ChevronDown className="size-3 rotate-180" />
              </Button>
            )}
            {onMoveDown && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onMoveDown}>
                <ChevronDown className="size-3" />
              </Button>
            )}
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
      <CollapsibleContent>
        <div className="p-4 bg-background">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};


export default function CourseStructureEditor({ courseId, isReadOnly }: { courseId: string, isReadOnly: boolean }) {
  const { data: structure, isLoading } = useGetCourseStructure(courseId);
  const replaceStructure = useReplaceCourseStructure();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [localSubjects, setLocalSubjects] = useState<any[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (structure && !initialized.current) {
      setLocalSubjects(deepCloneWithIds(structure.subjects || []));
      initialized.current = true;
    }
  }, [structure]);

  const handleSave = () => {
    const cleaned = cleanIds(localSubjects);
    replaceStructure.mutate(
      { courseId, data: { subjects: cleaned } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetCourseStructureQueryKey(courseId), data);
          toast({ title: 'Course structure saved successfully' });
        },
        onError: () => {
          toast({ title: 'Failed to save structure', variant: 'destructive' });
        }
      }
    );
  };

  const updateSubject = (idx: number, updated: any) => {
    const newSubs = [...localSubjects];
    newSubs[idx] = updated;
    setLocalSubjects(newSubs);
  };

  const removeSubject = (idx: number) => {
    setLocalSubjects(localSubjects.filter((_, i) => i !== idx));
  };

  const addSubject = () => {
    setLocalSubjects([...localSubjects, generateEmptySubject()]);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)]">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-serif font-semibold">Course Structure</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {isReadOnly ? 'This course is currently locked for editing.' : 'Build the curriculum hierarchy.'}
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={handleSave} disabled={replaceStructure.isPending} className="gap-2">
            <Save className="size-4" />
            {replaceStructure.isPending ? 'Saving...' : 'Save Structure'}
          </Button>
        )}
      </div>

      {isReadOnly && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg flex items-start gap-3 text-amber-800 dark:text-amber-200 text-sm">
          <AlertTriangle className="size-5 shrink-0" />
          <p>This course structure is read-only because it is in Review, Approved, Published, or Retired state. Move it to Draft to edit.</p>
        </div>
      )}

      <div className="flex-1 overflow-auto pr-2 pb-10 space-y-4">
        {localSubjects.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
            <p className="text-muted-foreground mb-4">No structure defined yet.</p>
            {!isReadOnly && <Button variant="outline" onClick={addSubject}>Add Subject</Button>}
          </div>
        ) : (
          localSubjects.map((sub, sIdx) => (
            <SubjectEditor 
              key={sub._id}
              subject={sub}
              onChange={(s: any) => updateSubject(sIdx, s)}
              onRemove={() => removeSubject(sIdx)}
              onMoveUp={sIdx > 0 ? () => setLocalSubjects(swapArrayItems(localSubjects, sIdx, sIdx - 1)) : undefined}
              onMoveDown={sIdx < localSubjects.length - 1 ? () => setLocalSubjects(swapArrayItems(localSubjects, sIdx, sIdx + 1)) : undefined}
              isReadOnly={isReadOnly}
            />
          ))
        )}

        {!isReadOnly && localSubjects.length > 0 && (
          <Button variant="outline" onClick={addSubject} className="w-full border-dashed gap-2">
            <Plus className="size-4" /> Add Subject
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------- LEVEL COMPONENTS ----------------

function SubjectEditor({ subject, onChange, onRemove, onMoveUp, onMoveDown, isReadOnly }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <EditorNode title={subject.title} subtitle="Subject" isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} isReadOnly={isReadOnly} colorClass="border-primary/20">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Subject Title</Label>
            <Input disabled={isReadOnly} value={subject.title} onChange={e => onChange({...subject, title: e.target.value})} placeholder="e.g. Mathematics" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input disabled={isReadOnly} value={subject.description} onChange={e => onChange({...subject, description: e.target.value})} placeholder="Subject description..." />
          </div>
        </div>

        <div className="pt-4 border-t mt-4">
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Modules in {subject.title || 'this subject'}</h4>
          <div className="pl-4 border-l-2 border-primary/20 space-y-3">
            {subject.modules.map((mod: any, mIdx: number) => (
              <ModuleEditor 
                key={mod._id} 
                module={mod} 
                isReadOnly={isReadOnly}
                onChange={(m: any) => {
                  const newMods = [...subject.modules];
                  newMods[mIdx] = m;
                  onChange({...subject, modules: newMods});
                }}
                onRemove={() => {
                  onChange({...subject, modules: subject.modules.filter((_: any, i: number) => i !== mIdx)});
                }}
                onMoveUp={mIdx > 0 ? () => onChange({...subject, modules: swapArrayItems(subject.modules, mIdx, mIdx - 1)}) : undefined}
                onMoveDown={mIdx < subject.modules.length - 1 ? () => onChange({...subject, modules: swapArrayItems(subject.modules, mIdx, mIdx + 1)}) : undefined}
              />
            ))}
            {!isReadOnly && (
              <Button variant="secondary" size="sm" onClick={() => onChange({...subject, modules: [...subject.modules, generateEmptyModule()]})}>
                <Plus className="size-3 mr-1" /> Add Module
              </Button>
            )}
          </div>
        </div>
      </div>
    </EditorNode>
  );
}

function ModuleEditor({ module, onChange, onRemove, onMoveUp, onMoveDown, isReadOnly }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <EditorNode title={module.title} subtitle="Module" isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} isReadOnly={isReadOnly}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Module Title</Label>
            <Input disabled={isReadOnly} value={module.title} onChange={e => onChange({...module, title: e.target.value})} placeholder="e.g. Algebra" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input disabled={isReadOnly} value={module.description} onChange={e => onChange({...module, description: e.target.value})} />
          </div>
        </div>

        <div className="pt-4 border-t mt-4">
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Units</h4>
          <div className="pl-4 border-l-2 border-muted space-y-3">
            {module.units.map((unit: any, uIdx: number) => (
              <UnitEditor 
                key={unit._id} 
                unit={unit} 
                isReadOnly={isReadOnly}
                onChange={(u: any) => {
                  const newUnits = [...module.units];
                  newUnits[uIdx] = u;
                  onChange({...module, units: newUnits});
                }}
                onRemove={() => {
                  onChange({...module, units: module.units.filter((_: any, i: number) => i !== uIdx)});
                }}
                onMoveUp={uIdx > 0 ? () => onChange({...module, units: swapArrayItems(module.units, uIdx, uIdx - 1)}) : undefined}
                onMoveDown={uIdx < module.units.length - 1 ? () => onChange({...module, units: swapArrayItems(module.units, uIdx, uIdx + 1)}) : undefined}
              />
            ))}
            {!isReadOnly && (
              <Button variant="outline" size="sm" onClick={() => onChange({...module, units: [...module.units, generateEmptyUnit()]})}>
                <Plus className="size-3 mr-1" /> Add Unit
              </Button>
            )}
          </div>
        </div>
      </div>
    </EditorNode>
  );
}

function UnitEditor({ unit, onChange, onRemove, onMoveUp, onMoveDown, isReadOnly }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <EditorNode title={unit.title} subtitle="Unit" isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} isReadOnly={isReadOnly}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Unit Title</Label>
            <Input disabled={isReadOnly} value={unit.title} onChange={e => onChange({...unit, title: e.target.value})} placeholder="e.g. Linear Equations" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input disabled={isReadOnly} value={unit.description} onChange={e => onChange({...unit, description: e.target.value})} />
          </div>
        </div>

        <div className="pt-4 border-t mt-4">
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">Lessons</h4>
          <div className="pl-4 border-l-2 border-muted space-y-3">
            {unit.lessons.map((lesson: any, lIdx: number) => (
              <LessonEditor 
                key={lesson._id} 
                lesson={lesson} 
                isReadOnly={isReadOnly}
                onChange={(l: any) => {
                  const newLessons = [...unit.lessons];
                  newLessons[lIdx] = l;
                  onChange({...unit, lessons: newLessons});
                }}
                onRemove={() => {
                  onChange({...unit, lessons: unit.lessons.filter((_: any, i: number) => i !== lIdx)});
                }}
                onMoveUp={lIdx > 0 ? () => onChange({...unit, lessons: swapArrayItems(unit.lessons, lIdx, lIdx - 1)}) : undefined}
                onMoveDown={lIdx < unit.lessons.length - 1 ? () => onChange({...unit, lessons: swapArrayItems(unit.lessons, lIdx, lIdx + 1)}) : undefined}
              />
            ))}
            {!isReadOnly && (
              <Button variant="outline" size="sm" onClick={() => onChange({...unit, lessons: [...unit.lessons, generateEmptyLesson()]})}>
                <Plus className="size-3 mr-1" /> Add Lesson
              </Button>
            )}
          </div>
        </div>
      </div>
    </EditorNode>
  );
}

function LessonEditor({ lesson, onChange, onRemove, onMoveUp, onMoveDown, isReadOnly }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <EditorNode title={lesson.title} subtitle="Lesson" isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} isReadOnly={isReadOnly}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Lesson Title</Label>
            <Input disabled={isReadOnly} value={lesson.title} onChange={e => onChange({...lesson, title: e.target.value})} placeholder="e.g. Graphing Lines" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input disabled={isReadOnly} value={lesson.description} onChange={e => onChange({...lesson, description: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t mt-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-muted-foreground">Activities</h4>
              {!isReadOnly && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange({...lesson, activities: [...lesson.activities, generateEmptyActivity()]})}>
                  <Plus className="size-3 mr-1" /> Add
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {lesson.activities.map((act: any, aIdx: number) => (
                <ActivityEditor 
                  key={act._id} 
                  activity={act} 
                  isReadOnly={isReadOnly}
                  onChange={(a: any) => {
                    const newActs = [...lesson.activities];
                    newActs[aIdx] = a;
                    onChange({...lesson, activities: newActs});
                  }}
                  onRemove={() => onChange({...lesson, activities: lesson.activities.filter((_: any, i: number) => i !== aIdx)})}
                  onMoveUp={aIdx > 0 ? () => onChange({...lesson, activities: swapArrayItems(lesson.activities, aIdx, aIdx - 1)}) : undefined}
                  onMoveDown={aIdx < lesson.activities.length - 1 ? () => onChange({...lesson, activities: swapArrayItems(lesson.activities, aIdx, aIdx + 1)}) : undefined}
                />
              ))}
              {lesson.activities.length === 0 && <div className="text-xs text-muted-foreground italic text-center py-2 bg-muted/10 rounded">No activities</div>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-muted-foreground">Assessments</h4>
              {!isReadOnly && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange({...lesson, assessments: [...lesson.assessments, generateEmptyAssessment()]})}>
                  <Plus className="size-3 mr-1" /> Add
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {lesson.assessments.map((ass: any, aIdx: number) => (
                <AssessmentEditor 
                  key={ass._id} 
                  assessment={ass} 
                  isReadOnly={isReadOnly}
                  onChange={(a: any) => {
                    const newAss = [...lesson.assessments];
                    newAss[aIdx] = a;
                    onChange({...lesson, assessments: newAss});
                  }}
                  onRemove={() => onChange({...lesson, assessments: lesson.assessments.filter((_: any, i: number) => i !== aIdx)})}
                  onMoveUp={aIdx > 0 ? () => onChange({...lesson, assessments: swapArrayItems(lesson.assessments, aIdx, aIdx - 1)}) : undefined}
                  onMoveDown={aIdx < lesson.assessments.length - 1 ? () => onChange({...lesson, assessments: swapArrayItems(lesson.assessments, aIdx, aIdx + 1)}) : undefined}
                />
              ))}
              {lesson.assessments.length === 0 && <div className="text-xs text-muted-foreground italic text-center py-2 bg-muted/10 rounded">No assessments</div>}
            </div>
          </div>
        </div>
      </div>
    </EditorNode>
  );
}

function ActivityEditor({ activity, onChange, onRemove, onMoveUp, onMoveDown, isReadOnly }: any) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <EditorNode title={activity.title} subtitle="Activity" isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} isReadOnly={isReadOnly} colorClass="bg-blue-50/10 dark:bg-blue-950/10 border-blue-200/50">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label className="text-xs">Title</Label>
            <Input disabled={isReadOnly} value={activity.title} onChange={e => onChange({...activity, title: e.target.value})} className="h-8 text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Minutes</Label>
            <Input type="number" disabled={isReadOnly} value={activity.instructionalMinutes} onChange={e => onChange({...activity, instructionalMinutes: parseInt(e.target.value) || 0})} className="h-8 text-sm" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Content</Label>
          <Textarea disabled={isReadOnly} value={activity.content} onChange={e => onChange({...activity, content: e.target.value})} className="text-sm min-h-[80px]" />
        </div>
      </div>
    </EditorNode>
  );
}

function AssessmentEditor({ assessment, onChange, onRemove, onMoveUp, onMoveDown, isReadOnly }: any) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <EditorNode title={assessment.title} subtitle="Assessment" isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} isReadOnly={isReadOnly} colorClass="bg-emerald-50/10 dark:bg-emerald-950/10 border-emerald-200/50">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Title</Label>
          <Input disabled={isReadOnly} value={assessment.title} onChange={e => onChange({...assessment, title: e.target.value})} className="h-8 text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Instructions</Label>
          <Textarea disabled={isReadOnly} value={assessment.instructions} onChange={e => onChange({...assessment, instructions: e.target.value})} className="text-sm min-h-[60px]" />
        </div>
        <div className="pt-2 border-t">
          <div className="flex justify-between items-center mb-2">
            <Label className="text-xs text-muted-foreground">Skills</Label>
            {!isReadOnly && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => onChange({...assessment, skills: [...assessment.skills, generateEmptySkill()]})}>
                Add Skill
              </Button>
            )}
          </div>
          <div className="space-y-2 pl-2 border-l border-emerald-200/50">
            {assessment.skills.map((skill: any, sIdx: number) => (
              <SkillEditor 
                key={skill._id} 
                skill={skill} 
                isReadOnly={isReadOnly}
                onChange={(s: any) => {
                  const newSkills = [...assessment.skills];
                  newSkills[sIdx] = s;
                  onChange({...assessment, skills: newSkills});
                }}
                onRemove={() => onChange({...assessment, skills: assessment.skills.filter((_: any, i: number) => i !== sIdx)})}
                onMoveUp={sIdx > 0 ? () => onChange({...assessment, skills: swapArrayItems(assessment.skills, sIdx, sIdx - 1)}) : undefined}
                onMoveDown={sIdx < assessment.skills.length - 1 ? () => onChange({...assessment, skills: swapArrayItems(assessment.skills, sIdx, sIdx + 1)}) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </EditorNode>
  );
}

function SkillEditor({ skill, onChange, onRemove, onMoveUp, onMoveDown, isReadOnly }: any) {
  return (
    <div className="group flex items-start gap-2 bg-background p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
      <div className="flex-1 space-y-2">
        <Input disabled={isReadOnly} value={skill.title} onChange={e => onChange({...skill, title: e.target.value})} placeholder="Skill title" className="h-7 text-xs" />
        <Input disabled={isReadOnly} value={skill.description} onChange={e => onChange({...skill, description: e.target.value})} placeholder="Description (optional)" className="h-7 text-xs" />
      </div>
      {!isReadOnly && (
        <div className="flex flex-col items-center opacity-0 group-hover:opacity-100">
          <div className="flex items-center">
            {onMoveUp && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={onMoveUp}>
                <ChevronDown className="size-3 rotate-180" />
              </Button>
            )}
            {onMoveDown && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={onMoveDown}>
                <ChevronDown className="size-3" />
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 mt-1 text-muted-foreground hover:text-destructive" onClick={onRemove}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}