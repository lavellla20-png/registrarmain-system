import { useState, useEffect } from 'react'
import { api, getErrorMessage } from '../api'

interface TORSubject {
  id: number
  subject_code: string
  descriptive_title: string
  grade_final: string
  completion: string
  credits: number
  semester: number
  year_level: number
}

interface StudentDetail {
  id: number
  student_id: string
  last_name: string
  first_name: string
  middle_name: string
  extension_name: string
  program: number
  year_level: number
  academic_year: string
  semester: number | null
  section: number | null
}

interface Program {
  id: number
  name: string
}

export function TranscriptPage() {
  const [searchId, setSearchId] = useState('')
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [torSubjects, setTorSubjects] = useState<TORSubject[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadPrograms = async () => {
    try {
      const response = await api.get<Program[]>('/programs/')
      setPrograms(response.data)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  useEffect(() => {
    loadPrograms()
  }, [])

  const searchStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setStudent(null)
    setTorSubjects([])

    try {
      const response = await api.get<StudentDetail>(`/students/${searchId}/`)
      const found = response.data
      setStudent(found)
      setSuccess('Student found.')
      
      // Load TOR subjects for this student
      loadTORSubjects(found.id)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const loadTORSubjects = async (studentId: number) => {
    try {
      const response = await api.get<TORSubject[]>(`/students/${studentId}/tor-subjects/`)
      setTorSubjects(response.data)
    } catch (err) {
      // Handle 404 error gracefully - TOR endpoint not implemented yet
      if (err instanceof Error && err.message.includes('404')) {
        setError('TOR subjects endpoint not implemented yet. Please contact administrator.')
      } else {
        setError(getErrorMessage(err))
      }
    }
  }

  const groupSubjectsByYearAndSemester = () => {
    const grouped: { [key: string]: TORSubject[] } = {}
    
    torSubjects.forEach(subject => {
      const key = `${subject.year_level}th Year - ${subject.semester === 1 ? '1st' : subject.semester === 2 ? '2nd' : 'Summer'} Semester`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(subject)
    })
    
    return grouped
  }

  const groupedSubjects = groupSubjectsByYearAndSemester()
  const yearSemesterOrder = [
    '1st Year - 1st Semester',
    '1st Year - 2nd Semester',
    '2nd Year - 1st Semester', 
    '2nd Year - 2nd Semester',
    '3rd Year - 1st Semester',
    '3rd Year - 2nd Semester',
    '4th Year - 1st Semester',
    '4th Year - 2nd Semester'
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Transcript of Records</h1>
      </div>

      <div className="sheet-container">
        <div className="enroll-sheet-form">
          <div className="sheet-section-title">Search Student</div>
          <form onSubmit={searchStudent} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Enter Student ID"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
              Load TOR
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {student && (
            <>
              <div className="sheet-section-title">Student Information</div>
              <div className="sheet-grid">
                <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Name</span>
                  <div className="readonly-field" style={{ flex: 1 }}>
                    {`${student.last_name}, ${student.first_name} ${student.middle_name || ''}. ${student.extension_name || ''}`}
                  </div>
                </div>
                <div className="field-inline-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Student ID</span>
                  <div className="readonly-field" style={{ flex: 1 }}>{student.student_id}</div>
                </div>
                <div className="field-inline-label" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Program</span>
                  <div className="readonly-field" style={{ flex: 1 }}>
                    {programs.find((p) => p.id === student.program)?.name || '-'}
                  </div>
                </div>
              </div>

              <div className="sheet-section-title">Transcript of Records</div>
              
              {yearSemesterOrder.map(yearSemester => {
                const subjects = groupedSubjects[yearSemester]
                if (!subjects || subjects.length === 0) return null
                
                return (
                  <div key={yearSemester} style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #333', paddingBottom: '0.5rem' }}>
                      {yearSemester}
                    </h3>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: '15%' }}>Subject Code</th>
                            <th style={{ width: '40%' }}>Descriptive Title</th>
                            <th style={{ width: '15%' }}>Grade Final</th>
                            <th style={{ width: '15%' }}>Completion</th>
                            <th style={{ width: '15%' }}>Credits</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjects.map((subject) => (
                            <tr key={subject.id}>
                              <td>{subject.subject_code}</td>
                              <td>{subject.descriptive_title}</td>
                              <td>{subject.grade_final}</td>
                              <td>{subject.completion}</td>
                              <td>{subject.credits}</td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                            <td colSpan={4} style={{ textAlign: 'right' }}>Total Credits:</td>
                            <td>
                              {subjects.reduce((sum, subject) => sum + subject.credits, 0)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}

              {torSubjects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  No TOR subjects found for this student.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
