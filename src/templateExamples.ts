import { App } from 'obsidian';
import { ensureFolderExists } from './utils';

/**
 * Create template examples in C/Templates/Templates Examples/
 * Only creates files if they don't already exist
 */
export async function createTemplateExamples(app: App): Promise<void> {
	const examplesPath = 'C/Templates/Templates Examples';
	await ensureFolderExists(app, examplesPath);

	// Define all template examples
	const templates = [
		{
			name: 'C-Intentions.md',
			content: `---
type: intention
status: 
date: 
tags:
  - {{VALUE:tags}}
lang: 
aliases:
---
## Task:
{{VALUE:Task}}

## Role(s):
{{VALUE:What role/roles do you represent}}

## Intentions:
Answer the following question:
Why am I as a {{VALUE:What role/roles do you represent}} do the {{VALUE:Task}}?

## The main knowledge block:


## Tools and resources:


## Projects:

### Educational projects:


### Practical projects:

`
		},{
			name: 'A-Inbox-Ideas.md',
			content: `---
type: idea
status: 
date: 
tags:
  - {{VALUE:tags}}
lang: 
aliases:
---
## About:
{{VALUE:What is the idea about}}

## When do you expect to use it?

## How to use it?

## Other related notes?

`
		},
		{
			name: 'A-Contacts.md',
			content: `---
type: contact
name: "{{VALUE:name}}"
date: 
tags: 
role: "{{VALUE:role}}"
lang: 
aliases:
---

## ℹ Contact Info:

{{VALUE:main contact info}}
### 🌐 Website:

{{VALUE:website}}
### 📧 email:

{{VALUE:email}}
### 📱 Phone Number:

{{VALUE:Phone Number}}
### 🔗 LinkedIn:

{{VALUE:LinkedIn}}
## Other info:

{{VALUE:Other info}}
`
		},
		{
			name: 'A-Permanent Notes.md',
			content: `---
type: permanent
date:
tags:
  - {{VALUE:tags}}
lang:
aliases:
author:
verified: "{{VALUE: Is Verified}}"
importance: "{{VALUE: Importance from 1 to 5 }}"
when-to-use: "{{VALUE: When to use }}"
complexity: "{{VALUE: Complexity from 1 to 5 }}"
---
{{VALUE:The permanent note}}

## Sources:
{{VALUE:The Source}}

`
		},
		{
			name: 'A-Prompts.md',
			content: `---
type: prompt
date:
tags:
  - "{ VALUE:tags }":
lang:
aliases:
---
## Prompt:
{{VALUE:prompt}}

## Usages
(List of expected usages)

## Source:
{{VALUE:source}}

`
		},
		{
			name: 'A-Quotes.md',
			content: `---
type: quote
date:
tags:
  - {{VALUE:tags}}
lang:
  - en
aliases:
author:
verified: "{{VALUE: Is Verified}}"
importance: "{{VALUE: Importance from 1 to 5 }}"
when-to-use: "{{VALUE: When to use }}"
complexity: "{{VALUE: Complexity from 1 to 5 }}"
---
### Quote: 
#### {{VALUE:quote}}

### Author/Authors: 
#### {{VALUE:author}}

### The Related Permanent Notes:

###### Source:
 {{VALUE:source}}

###### Reference (Bibliography):

 {{VALUE:bibliography}}

`
		},
		{
			name: 'B-AI Consultants.md',
			content: `---
type: ai-tool
date: 
tags:
- {{VALUE:tags}} 
lang: []
aliases:
---
## {{VALUE:title}}

### Main Conversation URL:

{{VALUE:url}}

### Main AI tool :

{{VALUE:ai tool}}
{{VALUE:ai tool version}}
{{VALUE:company}}
### Main Prompt:

{{VALUE:prompt}}

### Bibliography-Example:
(GPT-4 Omni, response to “Explain how to make pizza dough from common household ingredients,” OpenAI, March 7, 2023)
### Bibliography:

{{VALUE:ai tool}}-{{VALUE:ai tool version}}, response to *"{{VALUE:prompt}}"*, {{VALUE:company}}, {{VALUE:date in Month dd, yyyy}}
# 📓 Advisory Board-AI Consultants


***

## ❓ Question / Objective
(Write the main question or the conversation objective here)
{{VALUE:prompt}}

## 📋  Conversation
(Write the response to the questions and the the conversation here)

***

## 📝 Highlights & Comments

***

# 🗨 Quotes
(Convert highlights into quotes if needed)
Use the following citation format:
{{VALUE:ai tool}}-{{VALUE:ai tool version}}, response to *"{{VALUE:prompt}}"*, {{VALUE:company}}, {{VALUE:date in Month dd, yyyy}}

`
		},
		{
			name: 'B-Literature Notes-Articles.md',
			content: `---
type: literature
date: 
author: 
tags:
- {{VALUE:tags}} 
lang: 
aliases: 
---
### Formatted Bibliography
{{VALUE:bibliography}}
# 📓 The Literature Notes


## 📝 Highlights & Comments


# 🗨 Quotes

{{VALUE:bibliography}}

# ✒The Permanent Notes


###### Source:
 {{VALUE:source}}

`
		},
		{
			name: 'B-Literature Notes-YouTube Summaries.md',
			content: `---
type: literature
date: 
author: 
tags: 
- {{VALUE:tags}} 

published: 
lang: 
aliases:
---
### Formatted Bibliography
{{VALUE:bibliography}}

# 📓 Literature Notes


## 📝 Highlights & Comments

# 🗨 Quotes

{{VALUE:bibliography}}
# ✒The Permanent Notes


###### Source:
 {{VALUE:source}}

`
		},
		{
			name: 'Content-to-D-Projects-Habits Power Website.md',
			content: `---
type: project
---
# 0 Introduction

# 1 Vision and Conceptual Foundation
## 1.1 Purpose of the Project
### 1.1.1 Mission Statement
### 1.1.2 Problem the Website Solves
### 1.1.3 Target Audience and Use Cases
## 1.2 Core Philosophy
### 1.2.1 Behavior Change through Design
### 1.2.2 The Relationship between Habits and Digital Tools
### 1.2.3 Empowerment through Self-Tracking
## 1.3 Strategic Goals
### 1.3.1 Increase Daily Engagement
### 1.3.2 Encourage Consistent Habit Formation
### 1.3.3 Build a Community around Self-Improvement

# 2 Research and Requirements
## 2.1 Market and User Research
### 2.1.1 Competitor Analysis (Habitica, Notion, etc.)
### 2.1.2 User Persona Development
### 2.1.3 Behavior Mapping and Pain Points
## 2.2 Functional Requirements
### 2.2.1 Core Features and Modules
### 2.2.2 User Roles and Permissions
### 2.2.3 Accessibility and Multilingual Needs
## 2.3 Technical Requirements
### 2.3.1 Technology Stack Evaluation
### 2.3.2 Hosting and Deployment Strategy
### 2.3.3 Security and Data Protection

# 3 Information Architecture
## 3.1 Structural Layout
### 3.1.1 Site Map and Navigation
### 3.1.2 Page Hierarchies
### 3.1.3 User Flow Scenarios
## 3.2 Content Architecture
### 3.2.1 Habits Library
### 3.2.2 User Dashboard
### 3.2.3 Progress Analytics Section
## 3.3 UX Planning
### 3.3.1 Wireframes
### 3.3.2 Low-Fidelity Prototypes
### 3.3.3 User Testing Feedback Loops

# 4 UI/UX Design
## 4.1 Visual Identity
### 4.1.1 Logo and Branding
### 4.1.2 Color Psychology (Focus, Calm, Energy)
### 4.1.3 Typography and Layout Grids
## 4.2 Experience Design
### 4.2.1 Simplicity and Clarity
### 4.2.2 Gamification and Motivation
### 4.2.3 Emotional Design and Encouragement
## 4.3 Design System
### 4.3.1 Reusable Components
### 4.3.2 Style Guide
### 4.3.3 Accessibility Standards

# 5 Front-End Development
## 5.1 Framework Selection
### 5.1.1 React or Vue Evaluation
### 5.1.2 Responsive Design and Mobile Priority
### 5.1.3 State Management (Redux, Pinia, or Context)
## 5.2 Component Development
### 5.2.1 Navigation and Layout Components
### 5.2.2 Habit Tracker Components
### 5.2.3 Data Visualization Elements (Charts, Progress Bars)
## 5.3 User Interaction Layer
### 5.3.1 Input Validation
### 5.3.2 Notifications and Feedback
### 5.3.3 Accessibility Controls

# 6 Back-End Development
## 6.1 Architecture and Framework
### 6.1.1 RESTful or GraphQL API Design
### 6.1.2 Framework Choice (Node.js, Django, etc.)
### 6.1.3 Authentication and Authorization
## 6.2 Database Design
### 6.2.1 Schema for Users and Habits
### 6.2.2 Progress Tracking Tables
### 6.2.3 Analytics and Insights Storage
## 6.3 Integration and Automation
### 6.3.1 Email/Notification System
### 6.3.2 API Integrations (Calendar, Wearables)
### 6.3.3 Scheduled Jobs for Reminders

# 7 Habit System Logic
## 7.1 Core Habit Engine
### 7.1.1 Habit Creation Model
### 7.1.2 Cue–Routine–Reward Algorithm
### 7.1.3 Habit Streak Tracking
## 7.2 Gamification Layer
### 7.2.1 Points and Levels
### 7.2.2 Achievement Badges
### 7.2.3 Community Challenges
## 7.3 Analytics and Feedback
### 7.3.1 Daily Progress Dashboard
### 7.3.2 Behavior Insights
### 7.3.3 Personalized Recommendations

# 8 Testing and Quality Assurance
## 8.1 Functional Testing
### 8.1.1 Unit Tests
### 8.1.2 Integration Tests
### 8.1.3 End-to-End Flow
## 8.2 Usability Testing
### 8.2.1 User Session Feedback
### 8.2.2 Accessibility Evaluation
### 8.2.3 A/B Design Testing
## 8.3 Performance and Security Testing
### 8.3.1 Load and Speed Optimization
### 8.3.2 Vulnerability Scanning
### 8.3.3 Data Encryption Verification

# 9 Deployment and Launch
## 9.1 Hosting Setup
### 9.1.1 Server Configuration
### 9.1.2 CI/CD Pipeline
### 9.1.3 Environment Variables
## 9.2 Pre-Launch Checklist
### 9.2.1 Final QA Review
### 9.2.2 SEO and Meta Tags
### 9.2.3 Beta Testing with Early Users
## 9.3 Launch Execution
### 9.3.1 Marketing Rollout
### 9.3.2 Community Onboarding
### 9.3.3 Support Channels Activation

# 10 Maintenance and Growth
## 10.1 Continuous Improvement
### 10.1.1 Feature Iteration Based on Feedback
### 10.1.2 Regular Updates and Fixes
### 10.1.3 Design Refinement
## 10.2 Data and Analytics
### 10.2.1 User Retention Metrics
### 10.2.2 Engagement Reports
### 10.2.3 Habit Success Rate Analysis
## 10.3 Long-Term Expansion
### 10.3.1 Mobile App Integration
### 10.3.2 AI Habit Coach Module
### 10.3.3 Partnerships and Ecosystem Growth
`
		},
		{
			name: 'Content-to-D-YouTube Channel-Build Better Habits.md',
			content: `---
type: project
---
# 1 Choosing a channel name
## 1.1 Search for similar channels to suggest a name

# 2 Choosing topics for the channel
## 2.1 Identify the target audience
## 2.2 Identify the interests of the target audience
## 2.3 Identify a list of suggested names

# 3 Preparing Programs and Hardware
## 3.1 Researching the software and hardware used in the broadcast
## 3.2 Purchasing equipment

# 4 Content Creation Process
## 4.1 Script Writing
## 4.2 Video Recording
## 4.3 Video Editing

# 5 Channel Growth Strategy
## 5.1 SEO Optimization
## 5.2 Thumbnail Design
## 5.3 Social Media Promotion
`
		},
		{
			name: 'Content-to-D-YouTube Channel-Breaking Bad Habits.md',
			content: `---
type: project
---
# 1 Research Phase
## 1.1 Understanding Bad Habit Psychology
## 1.2 Identifying Common Bad Habits
## 1.3 Analyzing Success Stories

# 2 Content Planning
## 2.1 Video Topics List
## 2.2 Episode Structure
## 2.3 Script Templates

# 3 Production Setup
## 3.1 Equipment Requirements
## 3.2 Filming Location
## 3.3 Lighting and Audio Setup

# 4 Content Creation
## 4.1 Episode Recording
## 4.2 Editing Process
## 4.3 Thumbnail Creation

# 5 Distribution Strategy
## 5.1 Upload Schedule
## 5.2 Cross-Platform Sharing
## 5.3 Community Engagement
`
		}
	];

	// Create each template file if it doesn't exist
	for (const template of templates) {
		const filePath = `${examplesPath}/${template.name}`;
		
		try {
			const existing = app.vault.getAbstractFileByPath(filePath);
			if (!existing) {
				await app.vault.create(filePath, template.content);
			}
		} catch (error) {
			// Silently ignore "already exists" errors - this is expected behavior
			if (error instanceof Error && error.message.includes('already exists')) {
				continue;
			}
			// Log other unexpected errors
			console.error(`Failed to create template example ${template.name}:`, error);
		}
	}
}
