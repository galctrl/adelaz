import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jsxkigzwcuozvpdbtucf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeGtpZ3p3Y3VvenZwZGJ0dWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMwODgxNjEsImV4cCI6MjA0ODY2NDE2MX0.vj9csvFMebooysNX1abCcxdAtfynYzg4-3Tj3cQ-UIU'

export const supabase = createClient(supabaseUrl, supabaseKey) 