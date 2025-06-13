import { useState, useRef, useEffect } from 'react'
import { Box, Button, Container, Paper, Typography, List, ListItem } from '@mui/material'
import MicIcon from '@mui/icons-material/Mic'
import StopIcon from '@mui/icons-material/Stop'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import './App.css'

interface Message {
  type: 'user' | 'assistant'
  content: string
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const synthRef = useRef(window.speechSynthesis)

  useEffect(() => {
    // Initialize WebSocket connection
    websocketRef.current = new WebSocket('ws://localhost:8000/ws')
    
    websocketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'transcription') {
        // Update the last user message with the transcribed text
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.type === 'user') {
            return [...prev.slice(0, -1), {
              ...lastMessage,
              content: data.content
            }]
          }
          return prev
        })
      } else if (data.type === 'text') {
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.type === 'assistant') {
            // Append to existing assistant message
            return [...prev.slice(0, -1), {
              ...lastMessage,
              content: lastMessage.content + data.content
            }]
          } else {
            // Create new assistant message
            return [...prev, { type: 'assistant', content: data.content }]
          }
        })
      }
    }

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close()
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        chunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        
        reader.onload = () => {
          const base64Audio = (reader.result as string).split(',')[1]
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({
              type: 'audio',
              audio: base64Audio
            }))
          }
        }
        
        reader.readAsDataURL(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      // Add user message placeholder while waiting for transcription
      setMessages(prev => [...prev, { type: 'user', content: '...' }])
    }
  }

  const speakMessage = (text: string) => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel()
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onstart = () => setIsPlaying(true)
    utterance.onend = () => setIsPlaying(false)
    synthRef.current.speak(utterance)
  }

  return (
    <Container maxWidth="md" sx={{ height: '100vh', py: 4 }}>
      <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Voice Chat Assistant
        </Typography>
        
        <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
          <List>
            {messages.map((message, index) => (
              <ListItem
                key={index}
                sx={{
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                  mb: 1
                }}
              >
                <Paper
                  elevation={1}
                  sx={{
                    p: 2,
                    maxWidth: '80%',
                    bgcolor: message.type === 'user' ? 'primary.light' : 'grey.100'
                  }}
                >
                  <Typography>{message.content}</Typography>
                </Paper>
              </ListItem>
            ))}
          </List>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            color={isRecording ? 'error' : 'primary'}
            startIcon={isRecording ? <StopIcon /> : <MicIcon />}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Button>
          
          {messages.length > 0 && messages[messages.length - 1].type === 'assistant' && (
            <Button
              variant="contained"
              color={isPlaying ? 'secondary' : 'primary'}
              startIcon={<VolumeUpIcon />}
              onClick={() => speakMessage(messages[messages.length - 1].content)}
              disabled={isPlaying}
            >
              {isPlaying ? 'Speaking...' : 'Read Response'}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  )
}

export default App
