import { FormEvent, useEffect, useState } from 'react'

import { api, getErrorMessage } from '../api'
import { AddIcon, ChevronDownIcon, FolderIcon, RemoveIcon, SaveIcon } from '../components/Icons'

type Program = {
  id: number
  code: string
  name: string
}

type Subject = {
  id: number
  code: string
  title: string
  units: string
}

type ProspectusEntry = {
  id: number
  program: number
  subject: number
  year_level: number
  semester: number
  academic_year: string
  section: number | null
  prerequisite: number | null
}

type Section = {
  id: number
  name: string
  program: number
  year_level: number
  semester: number
}

const buildAcademicYearOptions = () => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 21 }, (_, i) => {
    const start = currentYear - 10 + i
    return `${start}-${start + 1}`
  })
}

const PROSPECTUS_FOLDERS_STORAGE_KEY = 'ccb_prospectus_folders_open_state'

export function ProspectusPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [entries, setEntries] = useState<ProspectusEntry[]>([])

  const [subjectCode, setSubjectCode] = useState('')
  const [subjectTitle, setSubjectTitle] = useState('')
  const [subjectUnits, setSubjectUnits] = useState('3.0')
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null)

  const [entryProgram, setEntryProgram] = useState('')
  const [entrySubjects, setEntrySubjects] = useState<string[]>([''])
  const [entryYearLevel, setEntryYearLevel] = useState('1')
  const [entrySemester, setEntrySemester] = useState('1')
  const [entryAcademicYear, setEntryAcademicYear] = useState('')
  const [entrySection, setEntrySection] = useState('')
  const [entryPrerequisite, setEntryPrerequisite] = useState('')
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [copyProgram, setCopyProgram] = useState('')
  const [copyYearLevel, setCopyYearLevel] = useState('1')
  const [copySemester, setCopySemester] = useState('1')
  const [copyAcademicYear, setCopyAcademicYear] = useState('')
  const [copySourceSection, setCopySourceSection] = useState('')
  const [copyTargetSection, setCopyTargetSection] = useState('')
  const [filterSection, setFilterSection] = useState('all')
  const [filterYearLevel, setFilterYearLevel] = useState('all')
  const [filterSemester, setFilterSemester] = useState('all')
  const [filterAcademicYear, setFilterAcademicYear] = useState('all')
  const [subjectSearch, setSubjectSearch] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [viewDetails, setViewDetails] = useState('')
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem(PROSPECTUS_FOLDERS_STORAGE_KEY)
      if (!raw) return {}
      return JSON.parse(raw) as Record<string, boolean>
    } catch {
      return {}
    }
  })

  const academicYearOptions = buildAcademicYearOptions()

  const loadData = async () => {
    const [programResp, subjectResp, sectionResp, entryResp] = await Promise.all([
      api.get<Program[]>('/programs/'),
      api.get<Subject[]>('/subjects/'),
      api.get<Section[]>('/sections/'),
      api.get<ProspectusEntry[]>('/prospectus/'),
    ])
    setPrograms(programResp.data)
    setSubjects(subjectResp.data)
    setSections(sectionResp.data)
    setEntries(entryResp.data)
  }

  useEffect(() => {
    loadData().catch((err) => setError(getErrorMessage(err)))
  }, [])

  useEffect(() => {
    window.localStorage.setItem(PROSPECTUS_FOLDERS_STORAGE_KEY, JSON.stringify(openFolders))
  }, [openFolders])

  const withFeedback = async (action: () => Promise<void>, message: string) => {
    setError('')
    setSuccess('')
    try {
      await action()
      await loadData()
      setSuccess(message)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const resetSubjectForm = () => {
    setSubjectCode('')
    setSubjectTitle('')
    setSubjectUnits('3.0')
    setEditingSubjectId(null)
  }

  const resetEntryForm = () => {
    setEntryProgram('')
    setEntrySubjects([''])
    setEntryYearLevel('1')
    setEntrySemester('1')
    setEntryAcademicYear('')
    setEntrySection('')
    setEntryPrerequisite('')
    setEditingEntryId(null)
  }

  const resetCopySectionForm = () => {
    setCopyProgram('')
    setCopyYearLevel('1')
    setCopySemester('1')
    setCopyAcademicYear('')
    setCopySourceSection('')
    setCopyTargetSection('')
  }

  const submitSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withFeedback(async () => {
      const payload = { code: subjectCode, title: subjectTitle, units: subjectUnits }
      if (editingSubjectId) {
        await api.put(`/subjects/${editingSubjectId}/`, payload)
      } else {
        await api.post('/subjects/', payload)
      }
      resetSubjectForm()
    }, editingSubjectId ? 'Subject updated.' : 'Subject created.')
  }

  const submitEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withFeedback(async () => {
      for (const subjectId of entrySubjects) {
        const payload = {
          program: Number(entryProgram),
          subject: Number(subjectId),
          year_level: Number(entryYearLevel),
          semester: Number(entrySemester),
          academic_year: entryAcademicYear,
          section: entrySection ? Number(entrySection) : null,
          prerequisite: entryPrerequisite ? Number(entryPrerequisite) : null,
        }
        if (editingEntryId) {
          await api.put(`/prospectus/${editingEntryId}/`, payload)
        } else {
          await api.post('/prospectus/', payload)
        }
      }
      resetEntryForm()
    }, editingEntryId ? 'Prospectus mapping updated.' : 'Prospectus mapping created.')
  }

  const handleDelete = async (resource: 'subjects' | 'prospectus', id: number, label: string) => {
    const confirmed = window.confirm(`Delete ${label}?`)
    if (!confirmed) return
    await withFeedback(async () => {
      await api.delete(`/${resource}/${id}/`)
    }, `${label} deleted.`)
  }

  const submitCopySection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await withFeedback(async () => {
      await api.post('/prospectus/copy-section/', {
        program: Number(copyProgram),
        year_level: Number(copyYearLevel),
        semester: Number(copySemester),
        academic_year: copyAcademicYear,
        source_section: Number(copySourceSection),
        target_section: Number(copyTargetSection),
      })
      resetCopySectionForm()
    }, 'Prospectus entries copied to target section.')
  }

  const handleView = (title: string, details: Record<string, unknown>) => {
    setViewDetails(`${title}: ${Object.entries(details)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(' | ')}`)
  }

  const startEditSubject = (subject: Subject) => {
    setSubjectCode(subject.code)
    setSubjectTitle(subject.title)
    setSubjectUnits(subject.units)
    setEditingSubjectId(subject.id)
  }

  const startEditEntry = (entry: ProspectusEntry) => {
    setEntryProgram(String(entry.program))
    setEntrySubjects([String(entry.subject)])
    setEntryYearLevel(String(entry.year_level))
    setEntrySemester(String(entry.semester))
    setEntryAcademicYear(entry.academic_year || '')
    setEntrySection(entry.section ? String(entry.section) : '')
    setEntryPrerequisite(entry.prerequisite ? String(entry.prerequisite) : '')
    setEditingEntryId(entry.id)
  }

  const subjectLabel = (id: number | null) => {
    if (!id) return '-'
    const subject = subjects.find((item) => item.id === id)
    return subject ? subject.code : String(id)
  }

  const programLabel = (id: number) => {
    const program = programs.find((item) => item.id === id)
    return program ? program.name : String(id)
  }

  const sectionLabel = (id: number | null) => {
    if (!id) return '-'
    const section = sections.find((item) => item.id === id)
    return section ? `${section.name} (Year ${section.year_level}, Sem ${section.semester})` : String(id)
  }
  const semesterLabel = (semester: number) => {
    if (semester === 1) return '1st Semester'
    if (semester === 2) return '2nd Semester'
    if (semester === 3) return 'Summer'
    return `Sem ${semester}`
  }

  const filteredSections = sections.filter(
    (section) =>
      (!entryProgram || String(section.program) === entryProgram) &&
      (!entryYearLevel || String(section.year_level) === entryYearLevel) &&
      (!entrySemester || String(section.semester) === entrySemester),
  )
  const copyFilteredSections = sections.filter(
    (section) =>
      (!copyProgram || String(section.program) === copyProgram) &&
      (!copyYearLevel || String(section.year_level) === copyYearLevel) &&
      (!copySemester || String(section.semester) === copySemester),
  )
  const filteredEntries = entries.filter(
    (entry) =>
      (filterSection === 'all' || String(entry.section ?? '') === filterSection) &&
      (filterYearLevel === 'all' || String(entry.year_level) === filterYearLevel) &&
      (filterSemester === 'all' || String(entry.semester) === filterSemester) &&
      (filterAcademicYear === 'all' || entry.academic_year === filterAcademicYear),
  )
  const sectionFilterOptions = sections
    .filter((section) => (filterYearLevel === 'all' ? true : String(section.year_level) === filterYearLevel))
    .filter((section) => (filterSemester === 'all' ? true : String(section.semester) === filterSemester))
  const filteredSubjects = subjects.filter((subject) => {
    const query = subjectSearch.trim().toLowerCase()
    if (!query) return true
    return subject.code.toLowerCase().includes(query) || subject.title.toLowerCase().includes(query)
  })
  const academicYearFilterOptions = Array.from(new Set(entries.map((entry) => entry.academic_year).filter(Boolean))).sort((a, b) =>
    b.localeCompare(a),
  )
  const groupedEntries = filteredEntries.reduce<Record<string, ProspectusEntry[]>>((groups, entry) => {
    const key = `${entry.program}|${entry.section ?? 'none'}|${entry.year_level}|${entry.semester}|${entry.academic_year || 'none'}`
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
    return groups
  }, {})
  const folderKeys = Object.keys(groupedEntries).sort((a, b) => {
    const [aProgram, aSection, aYear, aSem, aAcademicYear] = a.split('|')
    const [bProgram, bSection, bYear, bSem, bAcademicYear] = b.split('|')
    const byProgram = programLabel(Number(aProgram)).localeCompare(programLabel(Number(bProgram)))
    if (byProgram !== 0) return byProgram
    const byYear = Number(aYear) - Number(bYear)
    if (byYear !== 0) return byYear
    const bySemester = Number(aSem) - Number(bSem)
    if (bySemester !== 0) return bySemester
    const byAcademicYear = bAcademicYear.localeCompare(aAcademicYear)
    if (byAcademicYear !== 0) return byAcademicYear
    const aSectionLabel = sectionLabel(aSection === 'none' ? null : Number(aSection))
    const bSectionLabel = sectionLabel(bSection === 'none' ? null : Number(bSection))
    return aSectionLabel.localeCompare(bSectionLabel)
  })
  const onFolderToggle = (key: string, isOpen: boolean) => {
    setOpenFolders((current) => ({ ...current, [key]: isOpen }))
  }
  const isFolderOpen = (key: string, index: number) => {
    if (Object.prototype.hasOwnProperty.call(openFolders, key)) {
      return openFolders[key]
    }
    return index === 0
  }

  return (
    <section className="card">
      <h1>Prospectus Module</h1>
      <p>Define subjects, prerequisites, and semester mapping.</p>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}
      {viewDetails && <p>{viewDetails}</p>}

      <h2 className="section-title">Create Subject</h2>
      <form className="form-grid" onSubmit={submitSubject}>
        <input placeholder="Subject Code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} required />
        <input placeholder="Subject Title" value={subjectTitle} onChange={(e) => setSubjectTitle(e.target.value)} required />
        <input placeholder="Units" value={subjectUnits} onChange={(e) => setSubjectUnits(e.target.value)} required />
        <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <SaveIcon /> {editingSubjectId ? 'Update Subject' : 'Save Subject'}
        </button>
        {editingSubjectId && (
          <button type="button" onClick={resetSubjectForm}>
            Cancel Edit
          </button>
        )}
      </form>

      <h2 className="section-title">Create Prospectus Mapping</h2>
      <form className="form-grid" onSubmit={submitEntry}>
        <select value={entryProgram} onChange={(e) => setEntryProgram(e.target.value)} required>
          <option value="">Select Program</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>

        {/* Multiple Subject Selectors */}
        {entrySubjects.map((subject, idx) => (
          <select
            key={idx}
            value={subject}
            onChange={(e) => {
              const newSubjects = [...entrySubjects]
              newSubjects[idx] = e.target.value
              setEntrySubjects(newSubjects)
            }}
            required
          >
            <option value="">Select Subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} - {subject.title}
              </option>
            ))}
          </select>
        ))}
        <button
          type="button"
          onClick={() => setEntrySubjects([...entrySubjects, ''])}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}
        >
          <AddIcon /> Add Another Subject
        </button>
        {entrySubjects.length > 1 && (
          <button
            type="button"
            onClick={() => setEntrySubjects(entrySubjects.slice(0, -1))}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}
          >
            <RemoveIcon /> Remove Last Subject
          </button>
        )}

        <select value={entryYearLevel} onChange={(e) => setEntryYearLevel(e.target.value)}>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>

        <select value={entrySemester} onChange={(e) => setEntrySemester(e.target.value)}>
          <option value="1">1st Semester</option>
          <option value="2">2nd Semester</option>
          <option value="3">Summer</option>
        </select>

        <select value={entryAcademicYear} onChange={(e) => setEntryAcademicYear(e.target.value)} required>
          <option value="">Select Academic Year</option>
          {academicYearOptions.map((yearLabel) => (
            <option key={yearLabel} value={yearLabel}>
              {yearLabel}
            </option>
          ))}
        </select>

        <select value={entrySection} onChange={(e) => setEntrySection(e.target.value)} required>
          <option value="">Select Section</option>
          {filteredSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name} (Year {section.year_level}, Sem {section.semester})
            </option>
          ))}
        </select>

        <select value={entryPrerequisite} onChange={(e) => setEntryPrerequisite(e.target.value)}>
          <option value="">No Prerequisite</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code} - {subject.title}
            </option>
          ))}
        </select>

        <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <SaveIcon /> {editingEntryId ? 'Update Mapping' : 'Save Mapping'}
        </button>
        {editingEntryId && (
          <button type="button" onClick={resetEntryForm}>
            Cancel Edit
          </button>
        )}
      </form>

      <h2 className="section-title">Copy Prospectus by Section</h2>
      <form className="form-grid" onSubmit={submitCopySection}>
        <select value={copyProgram} onChange={(e) => setCopyProgram(e.target.value)} required>
          <option value="">Select Program</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>

        <select value={copyYearLevel} onChange={(e) => setCopyYearLevel(e.target.value)}>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>

        <select value={copySemester} onChange={(e) => setCopySemester(e.target.value)}>
          <option value="1">1st Semester</option>
          <option value="2">2nd Semester</option>
          <option value="3">Summer</option>
        </select>

        <select value={copyAcademicYear} onChange={(e) => setCopyAcademicYear(e.target.value)} required>
          <option value="">Select Academic Year</option>
          {academicYearOptions.map((yearLabel) => (
            <option key={yearLabel} value={yearLabel}>
              {yearLabel}
            </option>
          ))}
        </select>

        <select value={copySourceSection} onChange={(e) => setCopySourceSection(e.target.value)} required>
          <option value="">Select Source Section</option>
          {copyFilteredSections.map((section) => (
            <option key={section.id} value={section.id}>
              {sectionLabel(section.id)}
            </option>
          ))}
        </select>

        <select value={copyTargetSection} onChange={(e) => setCopyTargetSection(e.target.value)} required>
          <option value="">Select Target Section</option>
          {copyFilteredSections.map((section) => (
            <option key={section.id} value={section.id}>
              {sectionLabel(section.id)}
            </option>
          ))}
        </select>

        <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <SaveIcon /> Copy to Section
        </button>
      </form>

      <h2 className="section-title">Subject Catalog</h2>
      <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
        <input
          placeholder="Search by code or title"
          value={subjectSearch}
          onChange={(e) => setSubjectSearch(e.target.value)}
        />
      </form>
      <div className="table-wrap subject-catalog-scroll">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Units</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubjects.map((subject) => (
              <tr key={subject.id}>
                <td>{subject.code}</td>
                <td>{subject.title}</td>
                <td>{subject.units}</td>
                <td>
                  <button type="button" onClick={() => handleView('Subject', subject)}>
                    View
                  </button>
                  <button type="button" onClick={() => startEditSubject(subject)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete('subjects', subject.id, `Subject ${subject.code}`)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!filteredSubjects.length && (
              <tr>
                <td colSpan={4}>No subjects found for the current search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Prospectus Entries</h2>
      <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
        <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
          <option value="all">All Sections</option>
          {sectionFilterOptions.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name} (Year {section.year_level}, Sem {section.semester})
            </option>
          ))}
        </select>

        <select value={filterYearLevel} onChange={(e) => setFilterYearLevel(e.target.value)}>
          <option value="all">All Year Levels</option>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>

        <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)}>
          <option value="all">All Semesters</option>
          <option value="1">1st Semester</option>
          <option value="2">2nd Semester</option>
          <option value="3">Summer</option>
        </select>

        <select value={filterAcademicYear} onChange={(e) => setFilterAcademicYear(e.target.value)}>
          <option value="all">All Academic Years</option>
          {academicYearFilterOptions.map((yearLabel) => (
            <option key={yearLabel} value={yearLabel}>
              {yearLabel}
            </option>
          ))}
        </select>
      </form>
      {!folderKeys.length && <p>No prospectus folders found for the selected Section, Year Level, Semester, and Academic Year.</p>}
      <div className="admin-folders prospectus-folder-scroll">
        {folderKeys.map((folderKey, index) => {
          const [programId, sectionId, yearLevel, semester, academicYear] = folderKey.split('|')
          const folderEntries = groupedEntries[folderKey]
          const folderProgramLabel = programLabel(Number(programId))
          const folderSectionLabel = sectionLabel(sectionId === 'none' ? null : Number(sectionId))
          return (
            <details
              key={folderKey}
              className="admin-folder admin-folder-animated"
              open={isFolderOpen(folderKey, index)}
              onToggle={(event) => onFolderToggle(folderKey, event.currentTarget.open)}
            >
              <summary>
                <span className="folder-title folder-title-with-icon">
                  <FolderIcon />
                  {folderProgramLabel} | {folderSectionLabel} | Year {yearLevel} | {semesterLabel(Number(semester))} | {academicYear === 'none' ? '-' : academicYear}
                </span>
                <span className="folder-summary-right">
                  <span className="folder-count">{folderEntries.length}</span>
                  <span className="folder-toggle-icon" aria-hidden="true">
                    <ChevronDownIcon />
                  </span>
                </span>
              </summary>
              <div className="folder-collapse-content">
                <div className="folder-body table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Program</th>
                        <th>Subject</th>
                        <th>Prerequisite</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {folderEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{programLabel(entry.program)}</td>
                          <td>{subjectLabel(entry.subject)}</td>
                          <td>{subjectLabel(entry.prerequisite)}</td>
                          <td>
                            <button type="button" onClick={() => handleView('ProspectusEntry', entry)}>
                              View
                            </button>
                            <button type="button" onClick={() => startEditEntry(entry)}>
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDelete('prospectus', entry.id, `Prospectus entry ${entry.id}`)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
