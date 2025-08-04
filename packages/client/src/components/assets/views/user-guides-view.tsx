import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { AssetGeneratorWrapper } from '@/components/assets/asset-generator-wrapper'
import { BookOpen, Sparkles, Copy, Users, GraduationCap, HelpCircle } from 'lucide-react'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

interface UserGuidesViewProps {
  projectId: number
  projectName?: string
}

const userGuideTemplates = {
  gettingStarted: {
    name: 'Getting Started Guide',
    icon: GraduationCap,
    description: 'Step-by-step guide for new users',
    prompt: `Create a comprehensive Getting Started guide for {projectName}:

# Getting Started with {projectName}

## Welcome!
This guide will help you get up and running with {projectName} in just a few minutes.

## Prerequisites
Before you begin, make sure you have:
- [ ] An active account
- [ ] Required permissions
- [ ] System requirements met

## Step 1: Initial Setup
### Creating Your Account
1. Navigate to the sign-up page
2. Enter your email and create a password
3. Verify your email address
4. Complete your profile

[Include screenshot placeholders]

## Step 2: First Steps
### Creating Your First Project
1. Click the "New Project" button
2. Enter a project name and description
3. Configure initial settings
4. Invite team members (optional)

[Include screenshot placeholders]

## Step 3: Basic Operations
- How to navigate the interface
- Understanding the dashboard
- Using key features
- Customizing your workspace

## Common Tasks
### Task 1: [Common User Task]
Step-by-step instructions with screenshots

### Task 2: [Another Common Task]
Step-by-step instructions with screenshots

## Tips for Success
- Best practices for new users
- Common pitfalls to avoid
- Productivity tips

## Next Steps
- Explore advanced features
- Join the community
- Access additional resources`
  },
  userManual: {
    name: 'Complete User Manual',
    icon: BookOpen,
    description: 'Comprehensive documentation for all features',
    prompt: `Generate a complete user manual for {projectName}:

# {projectName} User Manual

## Table of Contents
1. Introduction
2. System Overview
3. User Interface Guide
4. Feature Documentation
5. Troubleshooting
6. FAQ
7. Glossary

## 1. Introduction
### About {projectName}
Overview of the application and its purpose

### Target Audience
Who this manual is for

### How to Use This Manual
Navigation tips and conventions

## 2. System Overview
### Architecture Overview
High-level system components

### User Roles and Permissions
- Administrator
- Manager
- User
- Guest

## 3. User Interface Guide
### Main Dashboard
[Screenshot placeholder]
- Navigation menu
- Quick actions
- Status indicators

### Settings Panel
[Screenshot placeholder]
- Personal preferences
- Account settings
- Notification preferences

## 4. Feature Documentation
### Feature Category 1
#### Sub-feature A
- Purpose
- How to access
- Step-by-step usage
- Tips and tricks

#### Sub-feature B
- Purpose
- How to access
- Step-by-step usage
- Tips and tricks

### Feature Category 2
[Continue pattern...]

## 5. Troubleshooting
### Common Issues
- Issue 1: Solution
- Issue 2: Solution
- Issue 3: Solution

### Error Messages
Table of error codes and resolutions

## 6. FAQ
Common questions and answers

## 7. Glossary
Key terms and definitions`
  },
  adminGuide: {
    name: 'Administrator Guide',
    icon: Users,
    description: 'Guide for system administrators',
    prompt: `Create an Administrator Guide for {projectName}:

# {projectName} Administrator Guide

## Overview
This guide covers administrative tasks and system management for {projectName}.

## Administrative Dashboard
### Accessing Admin Panel
- Login requirements
- Navigation to admin area
- Overview of admin capabilities

## User Management
### Managing User Accounts
- Creating new users
- Editing user profiles
- Assigning roles and permissions
- Deactivating accounts

### User Roles
| Role | Description | Permissions |
|------|-------------|-------------|
| Super Admin | Full system access | All |
| Admin | Administrative access | User management, settings |
| Manager | Team management | Team oversight, reports |
| User | Standard access | Basic features |

## System Configuration
### General Settings
- Application preferences
- Email configuration
- Integration settings
- Security settings

### Advanced Configuration
- Database maintenance
- Performance tuning
- Backup procedures
- Monitoring setup

## Security Management
### Security Best Practices
- Password policies
- Access control
- Audit logging
- Compliance requirements

### Security Features
- Two-factor authentication
- IP whitelisting
- Session management
- API key management

## Maintenance Tasks
### Regular Maintenance
- Daily tasks
- Weekly tasks
- Monthly tasks
- Annual tasks

### Troubleshooting
- System health checks
- Log analysis
- Performance monitoring
- Issue resolution

## Reporting and Analytics
### Available Reports
- User activity reports
- System usage statistics
- Performance metrics
- Audit reports

### Creating Custom Reports
- Report builder interface
- Scheduling reports
- Export options`
  },
  troubleshooting: {
    name: 'Troubleshooting Guide',
    icon: HelpCircle,
    description: 'Help users solve common problems',
    prompt: `Create a Troubleshooting Guide for {projectName}:

# {projectName} Troubleshooting Guide

## Quick Diagnostics
### Before You Begin
1. Check system status page
2. Verify internet connection
3. Clear browser cache
4. Try incognito/private mode

## Common Issues

### Login Problems
#### Issue: Cannot log in
**Symptoms:** Login button doesn't work, wrong password error
**Solutions:**
1. Reset your password
2. Check CAPS LOCK
3. Clear cookies
4. Contact support if locked out

#### Issue: Two-factor authentication not working
**Solutions:**
1. Sync device time
2. Use backup codes
3. Request new QR code

### Performance Issues
#### Issue: Application running slowly
**Diagnostic Steps:**
1. Check internet speed
2. Review browser console for errors
3. Disable browser extensions
4. Try different browser

**Solutions:**
- Clear application cache
- Reduce data on screen
- Update browser
- Check system requirements

### Data Issues
#### Issue: Data not saving
**Solutions:**
1. Check for validation errors
2. Verify permissions
3. Check storage quota
4. Review autosave settings

#### Issue: Missing data
**Solutions:**
1. Check filters
2. Verify permissions
3. Review deletion logs
4. Contact support for recovery

## Error Code Reference
| Code | Description | Solution |
|------|-------------|----------|
| E001 | Network timeout | Check connection |
| E002 | Invalid input | Review form data |
| E003 | Permission denied | Contact admin |
| E004 | Server error | Try again later |

## Advanced Troubleshooting
### Browser Developer Tools
- Opening console
- Checking network tab
- Reviewing errors
- Capturing HAR files

### Diagnostic Information
What to include when contacting support:
- User ID
- Time of issue
- Steps to reproduce
- Screenshots
- Browser/OS info`
  }
}

export function UserGuidesView({ projectId, projectName = 'Project' }: UserGuidesViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof userGuideTemplates>('gettingStarted')
  const [targetAudience, setTargetAudience] = useState('end-users')
  const [includeScreenshots, setIncludeScreenshots] = useState(true)
  const [includeVideos, setIncludeVideos] = useState(false)
  const [guideLength, setGuideLength] = useState('standard')
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const { copyToClipboard } = useCopyClipboard()

  const template = userGuideTemplates[selectedTemplate]

  const handleGenerateGuide = () => {
    setGeneratorOpen(true)
  }

  const handleCopyPrompt = async () => {
    const prompt = template.prompt.replace(/{projectName}/g, projectName)
    await copyToClipboard(prompt, {
      successMessage: 'User guide prompt copied'
    })
  }

  return (
    <div className='h-full flex flex-col p-6 space-y-6'>
      <div>
        <h2 className='text-2xl font-bold flex items-center gap-2'>
          <BookOpen className='h-6 w-6' />
          User Guides
        </h2>
        <p className='text-muted-foreground mt-1'>Create user-facing documentation for {projectName}</p>
      </div>

      <Tabs defaultValue='templates' className='flex-1'>
        <TabsList>
          <TabsTrigger value='templates'>Guide Templates</TabsTrigger>
          <TabsTrigger value='customize'>Customize</TabsTrigger>
          <TabsTrigger value='style'>Style Guide</TabsTrigger>
        </TabsList>

        <TabsContent value='templates' className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            {Object.entries(userGuideTemplates).map(([key, template]) => {
              const Icon = template.icon
              return (
                <Card
                  key={key}
                  className={`cursor-pointer transition-all ${selectedTemplate === key ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedTemplate(key as keyof typeof userGuideTemplates)}
                >
                  <CardHeader>
                    <div className='flex items-start justify-between'>
                      <div className='flex items-center gap-3'>
                        <Icon className='h-5 w-5 text-primary' />
                        <div>
                          <CardTitle className='text-base'>{template.name}</CardTitle>
                          <CardDescription className='text-sm'>{template.description}</CardDescription>
                        </div>
                      </div>
                      {selectedTemplate === key && <Badge>Selected</Badge>}
                    </div>
                  </CardHeader>
                </Card>
              )
            })}
          </div>

          <div className='flex gap-2'>
            <Button onClick={handleGenerateGuide} className='flex-1'>
              <Sparkles className='h-4 w-4 mr-2' />
              Generate User Guide
            </Button>
            <Button variant='outline' onClick={handleCopyPrompt}>
              <Copy className='h-4 w-4' />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value='customize' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Guide Configuration</CardTitle>
              <CardDescription>Customize the user guide for your audience</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label>Target Audience</Label>
                <Select value={targetAudience} onValueChange={setTargetAudience}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='end-users'>End Users</SelectItem>
                    <SelectItem value='power-users'>Power Users</SelectItem>
                    <SelectItem value='administrators'>Administrators</SelectItem>
                    <SelectItem value='developers'>Developers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Guide Length</Label>
                <Select value={guideLength} onValueChange={setGuideLength}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='concise'>Concise (Quick Reference)</SelectItem>
                    <SelectItem value='standard'>Standard</SelectItem>
                    <SelectItem value='comprehensive'>Comprehensive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Language Style</Label>
                <Select defaultValue='friendly'>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='friendly'>Friendly & Casual</SelectItem>
                    <SelectItem value='professional'>Professional</SelectItem>
                    <SelectItem value='technical'>Technical</SelectItem>
                    <SelectItem value='simple'>Simple & Clear</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-3'>
                <Label>Include Elements</Label>
                <div className='space-y-2'>
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      id='screenshots'
                      checked={includeScreenshots}
                      onCheckedChange={(checked) => setIncludeScreenshots(!!checked)}
                    />
                    <Label htmlFor='screenshots' className='cursor-pointer'>
                      Screenshot placeholders
                    </Label>
                  </div>

                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      id='videos'
                      checked={includeVideos}
                      onCheckedChange={(checked) => setIncludeVideos(!!checked)}
                    />
                    <Label htmlFor='videos' className='cursor-pointer'>
                      Video tutorial links
                    </Label>
                  </div>

                  <div className='flex items-center space-x-2'>
                    <Checkbox id='tips' defaultChecked />
                    <Label htmlFor='tips' className='cursor-pointer'>
                      Tips and best practices
                    </Label>
                  </div>

                  <div className='flex items-center space-x-2'>
                    <Checkbox id='warnings' defaultChecked />
                    <Label htmlFor='warnings' className='cursor-pointer'>
                      Warning and caution notes
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='style' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Documentation Style Guide</CardTitle>
              <CardDescription>Guidelines for consistent user documentation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Voice & Tone</h4>
                  <p className='text-sm text-muted-foreground'>
                    Use active voice, be concise, and maintain a helpful tone
                  </p>
                </div>
                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Formatting</h4>
                  <p className='text-sm text-muted-foreground'>
                    Use headings, bullet points, and numbered lists for clarity
                  </p>
                </div>
                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Visual Elements</h4>
                  <p className='text-sm text-muted-foreground'>
                    Include screenshots, diagrams, and callouts where helpful
                  </p>
                </div>
                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Accessibility</h4>
                  <p className='text-sm text-muted-foreground'>
                    Use alt text, proper heading structure, and clear language
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AssetGeneratorWrapper
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        assetType='user-guide'
        projectContext={{
          name: projectName,
          description: `User guides and documentation for ${projectName}`
        }}
        onSuccess={(content, name) => {
          // Handle success - will add prompt saving here
        }}
      />
    </div>
  )
}
