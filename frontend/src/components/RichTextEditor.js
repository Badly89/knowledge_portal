// components/RichTextEditor.js
import React, { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { tinymceConfig } from '../config/tinymce';

// ✅ Правильные импорты из node_modules
import 'tinymce/tinymce.min';
import 'tinymce/icons/default/icons.min';
import 'tinymce/themes/silver/theme.min';

// Плагины
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/link';
import 'tinymce/plugins/image';
import 'tinymce/plugins/charmap';

import 'tinymce/plugins/preview';
import 'tinymce/plugins/anchor';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/code';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/insertdatetime';
import 'tinymce/plugins/media';
import 'tinymce/plugins/table';

import 'tinymce/plugins/help';
import 'tinymce/plugins/wordcount';

function RichTextEditor({ value, onChange, height = 500 }) {
  const editorRef = useRef(null);

  // Простой и надежный обработчик загрузки
  const handleImageUpload = (blobInfo, progress) => {

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', blobInfo.blob(), blobInfo.filename());

      fetch('/api/articles/tinymce/upload', {
        method: 'POST',
        body: formData
        // Не устанавливайте Content-Type - браузер сделает это автоматически для FormData
      })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              throw new Error(err.error || 'Upload failed');
            });
          }
          return response.json();
        })
        .then(data => {
          if (data.location) {
            resolve(data.location);
          } else {
            reject('Invalid response from server');
          }
        })
        .catch(error => {
          reject('Upload error: ' + error.message);
        });
    });

  };

  const editorInit = {
    ...tinymceConfig.init,
    height: height,

    // Критически важные настройки для загрузки изображений
    images_upload_handler: handleImageUpload, // Через сервер
    automatic_uploads: true,
    paste_data_images: true,
    images_reuse_filename: true,

    // Дополнительные настройки для изображений
    image_advtab: true,
    image_title: true,
    image_caption: true,
    image_dimensions: true,

    // Настройка file picker для ручного выбора файлов
    file_picker_types: 'image',
    file_picker_callback: (callback, value, meta) => {
      if (meta.filetype === 'image') {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');

        input.onchange = function () {
          const file = this.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = function () {
            callback(reader.result, { alt: file.name });
          };
          reader.readAsDataURL(file);
        };

        input.click();
      }
    },
    images_upload_credentials: true,
    // Улучшенные стили контента
    content_style: `
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
        font-size: 14px; 
        line-height: 1.6; 
        margin: 1rem;
        color: #333;
      }
      img { 
        max-width: 100%; 
        height: auto; 
        display: block;
        margin: 1rem 0;
      }
    `,
  };

  return (
    <div className="rich-text-editor">
      <Editor
        apiKey={tinymceConfig.apiKey}
        onInit={(evt, editor) => {
          editorRef.current = editor;
          console.log('TinyMCE editor initialized');
        }}
        value={value}
        onEditorChange={onChange}
        init={editorInit}
      />

      {/* Подсказка для пользователя */}
      <div className="editor-help-text">
        <small>
          Для вставки изображения: перетащите файл в редактор, вставьте из буфера обмена (Ctrl+V)
          или используйте кнопку "Изображение" в панели инструментов. Поддерживаются JPG, PNG, GIF, WebP.
        </small>
      </div>
    </div>
  );
}

export default RichTextEditor;