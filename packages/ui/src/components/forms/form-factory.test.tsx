import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  FormFactory,
  createFormSchema,
  createFormComponent,
  createTextField,
  createTextareaField,
  createEmailField,
  createPasswordField,
  createSelectField,
  createCheckboxField,
  createSwitchField,
  createDateField,
  createTagsField,
  createFieldGroup,
  formValidation
} from './form-factory'

// Mock date-fns format function
vi.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => date.toLocaleDateString()
}))

describe('FormFactory', () => {
  const user = userEvent.setup()

  describe('Basic Form Functionality', () => {
    it('renders a simple form with text fields', () => {
      const schema = createFormSchema({
        name: z.string().min(1),
        email: z.string().email()
      })

      const handleSubmit = vi.fn()

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTextField({
              name: 'name',
              label: 'Name',
              placeholder: 'Enter your name'
            }),
            createEmailField({
              name: 'email',
              label: 'Email',
              placeholder: 'Enter your email'
            })
          ]}
          onSubmit={handleSubmit}
        />
      )

      expect(screen.getByLabelText('Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    })

    it('validates required fields', async () => {
      const schema = createFormSchema({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email')
      })

      const handleSubmit = vi.fn()

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTextField({
              name: 'name',
              label: 'Name',
              required: true
            }),
            createEmailField({
              name: 'email',
              label: 'Email',
              required: true
            })
          ]}
          onSubmit={handleSubmit}
        />
      )

      const submitButton = screen.getByRole('button', { name: /submit/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
      })

      expect(handleSubmit).not.toHaveBeenCalled()
    })

    it('submits form with valid data', async () => {
      const schema = createFormSchema({
        name: z.string().min(1),
        email: z.string().email()
      })

      const handleSubmit = vi.fn()

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTextField({
              name: 'name',
              label: 'Name'
            }),
            createEmailField({
              name: 'email',
              label: 'Email'
            })
          ]}
          onSubmit={handleSubmit}
        />
      )

      await user.type(screen.getByLabelText('Name'), 'John Doe')
      await user.type(screen.getByLabelText('Email'), 'john@example.com')
      await user.click(screen.getByRole('button', { name: /submit/i }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({
          name: 'John Doe',
          email: 'john@example.com'
        })
      })
    })
  })

  describe('Field Types', () => {
    it('renders textarea field correctly', () => {
      const schema = createFormSchema({
        description: z.string()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTextareaField({
              name: 'description',
              label: 'Description',
              placeholder: 'Enter description',
              rows: 4
            })
          ]}
          onSubmit={vi.fn()}
        />
      )

      const textarea = screen.getByLabelText('Description')
      expect(textarea).toBeInTheDocument()
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('renders password field with toggle', async () => {
      const schema = createFormSchema({
        password: z.string()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createPasswordField({
              name: 'password',
              label: 'Password',
              showToggle: true
            })
          ]}
          onSubmit={vi.fn()}
        />
      )

      const passwordField = screen.getByLabelText('Password')
      const toggleButton = screen.getByRole('button')

      expect(passwordField).toHaveAttribute('type', 'password')

      await user.click(toggleButton)
      expect(passwordField).toHaveAttribute('type', 'text')
    })

    it('renders select field with options', async () => {
      const schema = createFormSchema({
        country: z.string()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createSelectField({
              name: 'country',
              label: 'Country',
              options: [
                { value: 'us', label: 'United States' },
                { value: 'ca', label: 'Canada' },
                { value: 'uk', label: 'United Kingdom' }
              ]
            })
          ]}
          onSubmit={vi.fn()}
        />
      )

      const selectTrigger = screen.getByRole('combobox')
      await user.click(selectTrigger)

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument()
        expect(screen.getByText('Canada')).toBeInTheDocument()
        expect(screen.getByText('United Kingdom')).toBeInTheDocument()
      })
    })

    it('renders checkbox field', async () => {
      const schema = createFormSchema({
        agree: z.boolean()
      })

      const handleSubmit = vi.fn()

      render(
        <FormFactory
          schema={schema}
          fields={[
            createCheckboxField({
              name: 'agree',
              label: 'I agree to the terms'
            })
          ]}
          onSubmit={handleSubmit}
        />
      )

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()

      await user.click(checkbox)
      expect(checkbox).toBeChecked()

      await user.click(screen.getByRole('button', { name: /submit/i }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({
          agree: true
        })
      })
    })

    it('renders switch field', async () => {
      const schema = createFormSchema({
        notifications: z.boolean()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createSwitchField({
              name: 'notifications',
              label: 'Enable Notifications',
              description: 'Receive email notifications'
            })
          ]}
          onSubmit={vi.fn()}
        />
      )

      expect(screen.getByText('Enable Notifications')).toBeInTheDocument()
      expect(screen.getByText('Receive email notifications')).toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('renders tags field and allows adding/removing tags', async () => {
      const schema = createFormSchema({
        tags: z.array(z.string())
      })

      const handleSubmit = vi.fn()

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTagsField({
              name: 'tags',
              label: 'Tags',
              placeholder: 'Add tags...'
            })
          ]}
          onSubmit={handleSubmit}
        />
      )

      const tagInput = screen.getByPlaceholderText('Add tags...')

      // Add a tag
      await user.type(tagInput, 'react')
      await user.keyboard('{Enter}')

      expect(screen.getByText('react')).toBeInTheDocument()

      // Add another tag
      await user.type(tagInput, 'typescript')
      await user.keyboard('{Enter}')

      expect(screen.getByText('typescript')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /submit/i }))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({
          tags: ['react', 'typescript']
        })
      })
    })
  })

  describe('Field Groups', () => {
    it('renders field groups with titles and descriptions', () => {
      const schema = createFormSchema({
        firstName: z.string(),
        lastName: z.string()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createFieldGroup({
              title: 'Personal Information',
              description: 'Enter your personal details',
              fields: [
                createTextField({
                  name: 'firstName',
                  label: 'First Name'
                }),
                createTextField({
                  name: 'lastName',
                  label: 'Last Name'
                })
              ]
            })
          ]}
          onSubmit={vi.fn()}
        />
      )

      expect(screen.getByText('Personal Information')).toBeInTheDocument()
      expect(screen.getByText('Enter your personal details')).toBeInTheDocument()
      expect(screen.getByLabelText('First Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Last Name')).toBeInTheDocument()
    })

    it('handles collapsible field groups', async () => {
      const schema = createFormSchema({
        name: z.string()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createFieldGroup({
              title: 'Advanced Settings',
              collapsible: true,
              defaultExpanded: false,
              fields: [
                createTextField({
                  name: 'name',
                  label: 'Name'
                })
              ]
            })
          ]}
          onSubmit={vi.fn()}
        />
      )

      expect(screen.getByText('Advanced Settings')).toBeInTheDocument()
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()

      const expandButton = screen.getByText('Expand')
      await user.click(expandButton)

      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })
  })

  describe('Character Limits and Validation', () => {
    it('shows character count for text fields', async () => {
      const schema = createFormSchema({
        description: z.string()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTextareaField({
              name: 'description',
              label: 'Description',
              maxLength: 100,
              showCount: true
            })
          ]}
          onSubmit={vi.fn()}
        />
      )

      const textarea = screen.getByLabelText('Description')
      expect(screen.getByText('0/100')).toBeInTheDocument()

      await user.type(textarea, 'Hello world!')
      expect(screen.getByText('12/100')).toBeInTheDocument()
    })

    it('enforces character limits', async () => {
      const schema = createFormSchema({
        name: z.string()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTextField({
              name: 'name',
              label: 'Name',
              maxLength: 10
            })
          ]}
          onSubmit={vi.fn()}
        />
      )

      const input = screen.getByLabelText('Name')
      await user.type(input, 'This is a very long text that exceeds limit')

      expect(input).toHaveValue('This is a ')
    })
  })

  describe('Loading and Disabled States', () => {
    it('disables form when loading', () => {
      const schema = createFormSchema({
        name: z.string()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTextField({
              name: 'name',
              label: 'Name'
            })
          ]}
          onSubmit={vi.fn()}
          isLoading={true}
        />
      )

      expect(screen.getByLabelText('Name')).toBeDisabled()
      expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled()
    })

    it('shows loading text on submit button', () => {
      const schema = createFormSchema({
        name: z.string()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTextField({
              name: 'name',
              label: 'Name'
            })
          ]}
          onSubmit={vi.fn()}
          isLoading={true}
          submitButton={{
            text: 'Save',
            loadingText: 'Saving...'
          }}
        />
      )

      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  describe('Component Factory', () => {
    it('creates reusable form components', () => {
      const schema = createFormSchema({
        email: z.string().email(),
        password: z.string().min(8)
      })

      const LoginForm = createFormComponent({
        schema,
        fields: [
          createEmailField({
            name: 'email',
            label: 'Email'
          }),
          createPasswordField({
            name: 'password',
            label: 'Password'
          })
        ],
        submitButton: {
          text: 'Login'
        }
      })

      const handleSubmit = vi.fn()

      render(<LoginForm onSubmit={handleSubmit} />)

      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
    })
  })

  describe('Default Values', () => {
    it('sets default values correctly', () => {
      const schema = createFormSchema({
        name: z.string(),
        age: z.number(),
        subscribe: z.boolean()
      })

      render(
        <FormFactory
          schema={schema}
          fields={[
            createTextField({
              name: 'name',
              label: 'Name'
            }),
            createTextField({
              name: 'age',
              label: 'Age'
            }),
            createCheckboxField({
              name: 'subscribe',
              label: 'Subscribe'
            })
          ]}
          onSubmit={vi.fn()}
          defaultValues={{
            name: 'John Doe',
            age: 30,
            subscribe: true
          }}
        />
      )

      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('30')).toBeInTheDocument()
      expect(screen.getByRole('checkbox')).toBeChecked()
    })
  })

  describe('Form Validation Helpers', () => {
    it('validates email correctly', () => {
      const validEmail = formValidation.email.safeParse('test@example.com')
      const invalidEmail = formValidation.email.safeParse('invalid-email')

      expect(validEmail.success).toBe(true)
      expect(invalidEmail.success).toBe(false)
    })

    it('validates password length', () => {
      const validPassword = formValidation.password.safeParse('12345678')
      const invalidPassword = formValidation.password.safeParse('123')

      expect(validPassword.success).toBe(true)
      expect(invalidPassword.success).toBe(false)
    })

    it('validates name length', () => {
      const validName = formValidation.name.safeParse('John')
      const invalidName = formValidation.name.safeParse('')

      expect(validName.success).toBe(true)
      expect(invalidName.success).toBe(false)
    })
  })
})