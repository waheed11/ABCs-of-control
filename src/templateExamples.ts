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

/**
 * Create Arabic template examples in ت/القوالب/أمثلة على القوالب/
 * Only creates files if they don't already exist
 */
export async function createArabicTemplateExamples(app: App): Promise<void> {
    const examplesPath = 'ت/القوالب/أمثلة على القوالب';
    await ensureFolderExists(app, examplesPath);

    const templates = [
        {
            name: 'أ-اقتباسات.md',
            content: `---
النوع: اقتباس 
date:
tags:
  - {{VALUE:tags}}
اللغة:
  - ar
aliases:
القائل:
التحقق: "{{VALUE: هل تم التحقق}}"
الاهمية: "{{VALUE: الاهمية من 1 إلى 5 }}"
متى تستخدم: "{{VALUE: متى تستخدم }}"
التعقيد: "{{VALUE: التعقيد من 1 إلى 5 }}"
---
### الاقتباس: 
#### {{VALUE:الاقتباس}}

### القائل/القائلين: 
#### {{VALUE:القائل}}

### الملاحظات الدائمة المتعلقة

###### المصدر:
 {{VALUE:المصدر}}

###### المرجع (Bibliography):

 {{VALUE:المرجع}}
`
        },
        {
            name: 'أ-جهات الاتصال.md',
            content: `---
النوع: اتصال
الاسم: "{{VALUE:الاسم}}"
date: 
tags: 
المهنة: "{{VALUE:الدور}}"
اللغة: 
aliases:
---

## ℹ معلومات الاتصال:

{{VALUE:معلومات الاتصال الرئيسية}}
### 🌐 الموقع:

{{VALUE:الموقع}}
### 📧 الايميل:

{{VALUE:الايميل}}
### 📱 رقم الهاتف:

{{VALUE:رقم الهاتف}}
### 🔗 لينكدين:

{{VALUE:لينكدين}}
## معلومات أخرى:

{{VALUE:معلومات أخرى}}
`
        },
        {
            name: 'أ-صندوق الوارد-افكار.md',
            content: `---
النوع: فكرة
الحالة: 
date: 
tags:
  - {{VALUE:tags}}
اللغة: 
aliases:
---
## حول:
{{VALUE:حول ماذا تدور الفكرة}}

## متى تتوقع استخدامها؟

## كيف تستخدمها؟

## ملاحظات أخرى ذات صلة؟

`
        },
        {
            name: 'أ-مطالبات.md',
            content: `---
النوع: مطالبة
date:
tags:
  - {{VALUE:tags}}
اللغة:
aliases:
---
## المطالبة:
{{VALUE:المطالبة}}

## الاستخدام


## المصدر:
{{VALUE:source}}

`
        },
        {
            name: 'أ-ملاحظات دائمة.md',
            content: `---
النوع: ملاحظة دائمة
date:
tags:
  - {{VALUE:tags}}
اللغة:
aliases:
القائل:
التحقق: "{{VALUE: هل تم التحقق}}"
الاهمية: "{{VALUE: الاهمية من 1 إلى 5 }}"
متى تستخدم: "{{VALUE: متى الاستخدام }}"
التعقيد: "{{VALUE: التعقيد من 1 إلى 5 }}"
---
{{VALUE:الملاحظة الدائمة}}

## المصدر:
{{VALUE:المصدر}}

`
        },
        {
            name: 'ب-استشارة ذكاء اصطناعي.md',
            content: `---
النوع: ذكاء اصطناعي
date: 
tags:
- {{VALUE:tags}} 
اللغة:
  - ar
aliases:
---
## {{VALUE:العنوان}}

### الرابط الرئيسي للمحادثة:

{{VALUE:url}}

### أداة الذكاء الاصطناعي الرئيسية :

{{VALUE:أداة الذكاء الاصطناعي}}
{{VALUE:الاصدار}}
{{VALUE:الشركة}}
### المطالبة الرئيسية:

{{VALUE:المطالبة}}

### مثال للاشارة للمرجع:
(GPT-4 gemini، ردًا على "شرح كيفية صنع عجينة البيتزا من المكونات المنزلية الشائعة", OpenAI، 7 مارس 2023)
### المرجع:

{{VALUE:أداة الذكاء الاصطناعي}}-{{VALUE:الاصدار}},رداً على *"{{VALUE:المطالبة}}"*, {{VALUE:الشركة}}, {{VALUE:التاريخ على شكل  Month dd, yyyy}}
# 📓 استشارة الذكاء الاصطناعي


***

## ❓ السؤال / الهدف
(اكتب السؤال الرئيسي أو هدف المحادثة هنا)
{{VALUE:المطالبة}}

## 📋  المحادثة
(اكتب الإجابة على الأسئلة والمحادثة هنا)

***

## 📝 التحديدات والتعليقات

***

# 🗨 الاقتباسات
(تحويل النقاط البارزة إلى اقتباسات إذا لزم الأمر)
استخدم تنسيق الاقتباس التالي:
{{VALUE:أداة الذكاء الاصطناعي}}-{{VALUE:الاصدار}},رداً على *"{{VALUE:المطالبة}}"*, {{VALUE:الشركة}}, {{VALUE:التاريخ على شكل  Month dd, yyyy}}
`
        },
        {
            name: 'ب-ملاحظات أدبية-مقالات.md',
            content: `---
النوع: ملاحظة أدبية
date: 
الكاتب: 
tags:
- {{VALUE:tags}} 
اللغة: 
aliases: 
---

### ببليوغرافيا
{{{VALUE:ببليوغرافيا}}}
# 📓 الملاحظات الأدبية


## ##  الملاحظات والتعليقات


# # 🗨 اقتباسات

{{{VALUE:ببليوغرافيا}}}

# ✒ الملاحظات الدائمة


###### المصدر:
 {{VALUE:المصدر}}
`
        },
        {
            name: 'ب-ملاحظات أدبية-ملخصات يوتيوب.md',
            content: `---
النوع: ملاحظة أدبية
date: 
الكاتب: 
tags: 
- {{VALUE:tags}} 

النشر: 
اللغة: 
aliases:
---
### ببليوغرافيا
{{{VALUE:ببليوغرافيا}}}

# 📓 ملاحظات أدبية


## ##  التحديدات والتعليقات

# # 🗨 اقتباسات

{{VALUE:الببليوغرافيا}}
# # ✒ الملاحظات الدائمة


###### المصدر:
 {{VALUE:المصدر}}


###### Source:
 {{VALUE:المصدر}}
`
        },
        {
            name: 'محتوى-الى-ث-قناة اليوتيوب-بناء عادات افضل.md',
            content: `---
النوع: مشروع
---
# 1 مرحلة البحث
## 1.1 فهم سيكولوجية العادات الحسنة
## 1.2 تحديد العادات الجيدة الشائعة 
## 1.3 تحليل قصص النجاح 

# 2 تخطيط المحتوى
## 2.1 قائمة مواضيع الفيديو
## 2.2 هيكل الحلقة
## 2.3 قوالب النص البرمجي

# 3 إعداد الإنتاج
## 3.1 متطلبات المعدات
## 3.2 موقع التصوير
## 3.3 إعدادات الإضاءة والصوت

# 4 إنشاء المحتوى
## 4.1 تسجيل الحلقة
## 4.2 عملية التحرير
## 4.3 إنشاء الصور المصغرة 

# 5 استراتيجية التوزيع
## 5.1 جدول التحميل
## 5.2 المشاركة عبر المنصات
## 5.3 مشاركة المجتمع`
        },
        {
            name: 'محتوى-الى-ث-قناة اليوتيوب-كسر عادات سيئة.md',
            content: `---
النوع: مشروع
---
# 1 مرحلة البحث
## 1.1 فهم سيكولوجية العادات السيئة
## 1.2 تحديد العادات السيئة الشائعة 
## 1.3 تحليل قصص النجاح 

# 2 تخطيط المحتوى
## 2.1 قائمة مواضيع الفيديو
## 2.2 هيكل الحلقة
## 2.3 قوالب النص البرمجي

# 3 إعداد الإنتاج
## 3.1 متطلبات المعدات
## 3.2 موقع التصوير
## 3.3 إعدادات الإضاءة والصوت

# 4 إنشاء المحتوى
## 4.1 تسجيل الحلقة
## 4.2 عملية التحرير
## 4.3 إنشاء الصور المصغرة 

# 5 استراتيجية التوزيع
## 5.1 جدول التحميل
## 5.2 المشاركة عبر المنصات
## 5.3 مشاركة المجتمع
`
        },
        {
            name: 'محتوى-الى-ث-مشاريع-موقع قوة العادات.md',
            content: `---
type: project
---
# 0 مقدمة

# 1 الرؤية والأساس المفاهيمي
## 1.1 الغرض من المشروع
### 1.1.1.1 بيان المهمة
### 1.1.2 المشكلة التي يحلها الموقع الإلكتروني
### 1.1.3 الجمهور المستهدف وحالات الاستخدام
## 1.2 الفلسفة الأساسية
### 1.2.1 تغيير السلوك من خلال التصميم
### 1.2.2.2 العلاقة بين العادات والأدوات الرقمية
### 1.2.3 التمكين من خلال التتبع الذاتي
## 1.3 الأهداف الاستراتيجية
### 1.3.1 زيادة المشاركة اليومية
### 1.3.2 تشجيع تكوين عادات متسقة
### 1.3.3.3 بناء مجتمع حول التحسين الذاتي

# 2 البحث والمتطلبات
## 2.1 أبحاث السوق والمستخدمين
### 2.1.1.1 تحليل المنافسين (Habitica، Notion، إلخ.)
### تطوير شخصية المستخدم
### 2.1.3 رسم خرائط السلوك ونقاط الألم
## 2.2 المتطلبات الوظيفية
### 2.2.1 الميزات والوحدات الأساسية
### 2.2.2.2 أدوار المستخدم والأذونات
### 2.2.3 إمكانية الوصول والاحتياجات متعددة اللغات
## 2.3 المتطلبات التقنية
### 2.3.1 تقييم مكدس التكنولوجيا 
#### 2.3.2 استراتيجية الاستضافة والنشر
#### 2.3.3.3 الأمن وحماية البيانات
### 2.3.3 الأمن وحماية البيانات

# 3 بنية المعلومات
# ## 3.1 التخطيط الهيكلي
### 3.1.1.1 خريطة الموقع والتصفح
### 3.1.2 التسلسل الهرمي للصفحات
### 3.1.3 سيناريوهات تدفق المستخدم ### 3.1.3 سيناريوهات تدفق المستخدم
## 3.2 بنية المحتوى
### 3.2.1 مكتبة العادات 
### 3.2.2.2 لوحة معلومات المستخدم
### 3.2.3 قسم تحليلات التقدم
## 3.3 تخطيط تجربة المستخدم
### 3.3.1 الإطارات السلكية
### 3.3.2 النماذج الأولية منخفضة الدقة
### 3.3.3.3 حلقات تعليقات اختبار المستخدم

# 4 تصميم واجهة المستخدم/تجربة المستخدم
## 4.1 الهوية المرئية
### 4.1.1.1 الشعار والعلامة التجارية
### 4.1.2 سيكولوجية الألوان (التركيز، الهدوء، الطاقة)
### 4.1.3 الطباعة وشبكات التخطيط
## 4.2 تصميم التجربة
### 4.2.1 البساطة والوضوح
 ### 4.2.2 التلعيب والتحفيز
### 4.2.3 التصميم العاطفي والتشجيع 
## 4.3 نظام التصميم
### 4.3.1 المكونات القابلة لإعادة الاستخدام
### 4.3.2 دليل النمط
### 4.3.3.3 معايير إمكانية الوصول

# 5 تطوير الواجهة الأمامية
## 5.1 اختيار الإطار
### 5.1.1 تقييم React أو Vue
### 5.1.2 التصميم المتجاوب وأولوية الهاتف المحمول
### 5.1.3 إدارة الحالة (ريداكس أو بينيا أو السياق)
## 5.2 تطوير المكوّنات
### 5.2.1 مكونات التنقل والتخطيط
### 5.2.2.2 مكونات تعقب العادة
### 5.2.3 عناصر تصور البيانات (الرسوم البيانية، وأشرطة التقدم)
## 5.3 طبقة تفاعل المستخدم 
### 5.3.1 التحقق من صحة الإدخال
### 5.3.2 الإخطارات والتعليقات
### 5.3.3.3 عناصر التحكم في إمكانية الوصول

# 6 التطوير الخلفي
## 6.1 البنية وإطار العمل
### 6.1.1.1 تصميم واجهة برمجة تطبيقات RESTful أو GraphQL
### 6.1.2 اختيار إطار العمل (Node.js، Django، إلخ)
### 6.1.3 المصادقة والتخويل 
## 6.2 تصميم قاعدة البيانات
### 6.2.1 مخطط للمستخدمين والعادات 
### 6.2.2.2 جداول تتبع التقدم
### 6.2.3 تخزين التحليلات والرؤى 
# ## 6.3 التكامل والأتمتة
### 6.3.1 نظام البريد الإلكتروني/التنبيهات
### 6.3.2 تكامل واجهة برمجة التطبيقات (التقويم، الأجهزة القابلة للارتداء)
### 6.3.3.3 الوظائف المجدولة للتذكير

# 7 منطق نظام العادة 
## 7.1 محرك العادة الأساسي
### 7.1.1.1 نموذج إنشاء العادة
### 7.1.2 خوارزمية المكافأة الروتينية-الإرشادية
### 7.1.3 تتبع مسار العادة 
## 7.2 طبقة التلعيب
### 7.2.1 النقاط والمستويات
### 7.2.2.2 شارات الإنجاز
### 7.2.3 تحديات المجتمع
## 7.3 التحليلات والملاحظات 
### 7.3.1 لوحة متابعة التقدم اليومي
### 7.3.2 رؤى السلوك 
### 7.3.3.3 التوصيات المخصصة 

# 8 الاختبار وضمان الجودة
## 8.1 الاختبار الوظيفي
### 8.1.1 اختبارات الوحدة 
### 8.1.2 اختبارات التكامل 
### 8.1.3 التدفق من النهاية إلى النهاية
## 8.2 اختبار قابلية الاستخدام
### 8.2.1 ملاحظات جلسة المستخدم
### 8.2.2.2 تقييم سهولة الاستخدام
### 8.2.3 اختبار تصميم A/B
## 8.3 اختبار الأداء والأمان
### 8.3.1 تحسين الحمل والسرعة
### 8.3.2 فحص الثغرات الأمنية 
### 8.3.3.3 التحقق من تشفير البيانات

# 9 النشر والإطلاق
## 9.1 إعداد الاستضافة
### 9.1.1.1 تكوين الخادم
### 9.1.2 خط أنابيب CI/CD Pipeline
### 9.1.3 متغيرات البيئة 
## 9.2 قائمة مراجعة ما قبل الإطلاق
### 9.2.1 مراجعة ضمان الجودة النهائي
### 9.2.2.2 تحسين محركات البحث والعلامات الوصفية
### 9.2.3 الاختبار التجريبي مع المستخدمين الأوائل
# ## 9.3 تنفيذ الإطلاق
### 9.3.1 طرح التسويق 
### 9.3.2 تأهيل المجتمع
### 9.3.3.3 تفعيل قنوات الدعم

# 10 الصيانة والنمو
## 10.1 التحسين المستمر
### 10.1.1.1 تكرار الميزات بناءً على الملاحظات
### 10.1.2 التحديثات والإصلاحات المنتظمة
### 10.1.3 تنقيح التصميم 
## 10.2 البيانات والتحليلات
### 10.2.1 مقاييس الاحتفاظ بالمستخدمين
### 10.2.2.2 تقارير التفاعل
### 10.2.3 تحليل معدل نجاح العادة 
## 10.3 التوسع طويل الأجل 
### 10.3.1 تكامل تطبيق الهاتف المحمول
### 10.3.2 وحدة مدرب العادة بالذكاء الاصطناعي
### 10.3.3.3 الشراكات ونمو النظام البيئي
`
        }
    ];

    for (const template of templates) {
        const filePath = `${examplesPath}/${template.name}`;
        try {
            const existing = app.vault.getAbstractFileByPath(filePath);
            if (!existing) {
                await app.vault.create(filePath, template.content);
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('already exists')) {
                continue;
            }
            console.error(`Failed to create Arabic template example ${template.name}:`, error);
        }
    }
}
