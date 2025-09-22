---
type: literature
date: 
author: {% if author %}{{author}}{% endif %}
tags: {% if allTags %}{{allTags}}{% endif %}
published: 
lang: 
aliases: 
---

## {{title}}

### Formatted Bibliography

{{bibliography}}

# 📓 The Literature Notes
## 📚 Summary
{% if abstractNote %}
### Abstract
{{abstractNote}}
{%- endif -%}
***
## 📝 Highlights & Comments
### Imported on {{importDate | format("YYYY-MM-DD HH:mm")}}

{% for annot in annotations -%}
{%- if annot.annotatedText -%}

**Highlight**: <mark class="hltr-{{annot.colorCategory | lower}}">"{{annot.annotatedText | nl2br}}"</mark>


{%- endif -%}
{%- if annot.imageRelativePath %}
![[{{annot.imageRelativePath}}]]
{%- endif %}
{%- if annot.ocrText %}
{{annot.ocrText}}
{%- endif %}
{%if annot.comment %}
**Comment**: {{annot.comment | nl2br}}
{%- endif %}
{% if annot.allTags %}
**Tag**: {{annot.allTags | nl2br}}
{% endif  %}
 [Page {{annot.page}}](zotero://open-pdf/library/items/{{annot.attachment.itemKey}}?page={{annot.page}}) {{annot.date | format("YYYY-MM-DD HH:mm")}}
***
{% endfor %}




# 🗨 Quotes



# ✒The Permanent Notes




# 🏗The Related Projects

